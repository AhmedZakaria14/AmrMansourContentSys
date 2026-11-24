import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type DocumentData,
  type FirestoreError,
  type QuerySnapshot,
} from 'firebase/firestore';
import {
  db,
  FIRESTORE_COLLECTION_NAME,
  isFirebaseConfigured,
} from '../firebase-config';
import type {
  AggregatorContentItem,
  ContentStatus,
  DateCountOption,
} from '../types/content';
import { buildSampleContent } from '../data/sampleContent';
import { getEgyptDateString } from '../utils/dateUtils';
import {
  getAvailableDates,
  isValidContentStatus,
  normalizeFirestoreDocument,
  sortItemsByCreatedAtDesc,
} from '../utils/contentUtils';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';

export type SampleDataReason = 'unconfigured' | 'empty_collection' | null;

function reportStructuredFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  try {
    handleFirestoreError(error, operationType, path);
  } catch {
    // Structured FirestoreErrorInfo JSON already logged for diagnostics;
    // UI surfaces a localized Arabic error state or toast.
  }
}

function translateFirestoreUpdateError(err: unknown): string {
  const code = (err as FirestoreError)?.code ?? '';
  switch (code) {
    case 'permission-denied':
      return 'ليست لديك صلاحية تعديل الحالة في Firestore. يرجى التحقق من قواعد الأمان أو تسجيل الدخول.';
    case 'unauthenticated':
      return 'انتهت جلسة تسجيل الدخول. يرجى إعادة تسجيل الدخول والمحاولة مجدداً.';
    case 'not-found':
      return 'لم يتم العثور على هذا العنصر في قاعدة البيانات.';
    case 'unavailable':
      return 'تعذر الاتصال بقاعدة البيانات حالياً. يرجى التحقق من اتصال الإنترنت.';
    default:
      return 'تعذر تحديث الحالة في Firestore. يرجى المحاولة مرة أخرى.';
  }
}

function parseSnapshotDocs(
  snapshot: QuerySnapshot<DocumentData>,
  fallbackDate: string
): AggregatorContentItem[] {
  return sortItemsByCreatedAtDesc(
    snapshot.docs.map((docSnap) =>
      normalizeFirestoreDocument(
        docSnap.id,
        docSnap.data() as Record<string, unknown> | undefined,
        fallbackDate
      )
    )
  );
}

/**
 * Manages live Firestore reads (onSnapshot) and status-only updates for `aggregator_content`.
 * - NEVER creates or deletes documents in Firestore (writes come from external Admin SDK aggregator).
 * - Today view subscribes with `where('content_date', '==', todayEgyptDate)` + `orderBy('created_at', 'desc')`.
 * - Archive view subscribes with `where('content_date', '==', selectedArchiveDate)` when a date is chosen,
 *   plus maintains an index of available dates for the sidebar and "جميع الأيام" view.
 */
export function useAggregatorContent(
  isSignedIn: boolean,
  selectedArchiveDate: string
) {
  const configured = isFirebaseConfigured() && db !== null;
  const todayDate = useMemo(() => getEgyptDateString(), []);

  // Demo/sample fallback state (used when unconfigured or when Firestore collection is completely empty)
  const [sampleItems, setSampleItems] = useState<AggregatorContentItem[]>(() =>
    buildSampleContent()
  );

  // Live Firestore states
  const [liveTodayItems, setLiveTodayItems] = useState<AggregatorContentItem[]>([]);
  const [liveArchiveDateItems, setLiveArchiveDateItems] = useState<AggregatorContentItem[]>([]);
  const [liveAllItems, setLiveAllItems] = useState<AggregatorContentItem[]>([]);

  const [todayLoading, setTodayLoading] = useState<boolean>(true);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);
  const [collectionChecked, setCollectionChecked] = useState<boolean>(false);
  const [isCollectionEmpty, setIsCollectionEmpty] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
  const [retryCount, setRetryCount] = useState<number>(0);

  // 1. LIVE TODAY QUERY: where('content_date', '==', todayDate) + orderBy('created_at', 'desc')
  useEffect(() => {
    if (!isSignedIn) {
      setLiveTodayItems([]);
      setTodayLoading(false);
      setError(null);
      return;
    }

    if (!configured || !db) {
      setTodayLoading(false);
      setError(null);
      return;
    }

    setTodayLoading(true);
    setError(null);

    const collectionRef = collection(db, FIRESTORE_COLLECTION_NAME);
    let activeUnsubscribe: (() => void) | null = null;
    let fallbackTriggered = false;

    const handleTodaySnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      setLiveTodayItems(parseSnapshotDocs(snapshot, todayDate));
      setError(null);
      setTodayLoading(false);
    };

    const subscribeWithoutOrderBy = () => {
      const simpleTodayQuery = query(
        collectionRef,
        where('content_date', '==', todayDate)
      );
      activeUnsubscribe = onSnapshot(
        simpleTodayQuery,
        handleTodaySnapshot,
        (snapErr) => {
          reportStructuredFirestoreError(snapErr, OperationType.LIST, FIRESTORE_COLLECTION_NAME);
          setError(
            'تعذر تحميل محتوى اليوم من قاعدة البيانات. يرجى التحقق من قواعد الأمان أو إعادة المحاولة.'
          );
          setTodayLoading(false);
        }
      );
    };

    const orderedTodayQuery = query(
      collectionRef,
      where('content_date', '==', todayDate),
      orderBy('created_at', 'desc')
    );

    activeUnsubscribe = onSnapshot(
      orderedTodayQuery,
      handleTodaySnapshot,
      (snapErr) => {
        // If composite index (content_date + created_at) is not created yet, fall back seamlessly
        if (!fallbackTriggered && snapErr.code === 'failed-precondition') {
          fallbackTriggered = true;
          console.warn(
            'Firestore composite index missing for (content_date, created_at); falling back to client-side sort:',
            snapErr.message
          );
          if (activeUnsubscribe) activeUnsubscribe();
          subscribeWithoutOrderBy();
          return;
        }
        reportStructuredFirestoreError(snapErr, OperationType.LIST, FIRESTORE_COLLECTION_NAME);
        setError(
          'تعذر الاتصال بقاعدة بيانات Firestore. يرجى التحقق من الصلاحيات أو إعادة المحاولة.'
        );
        setTodayLoading(false);
      }
    );

    return () => {
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }, [configured, isSignedIn, todayDate, retryCount]);

  // 2. LIVE COLLECTION OVERVIEW QUERY (for past-days sidebar, "جميع الأيام", & empty-collection detection)
  useEffect(() => {
    if (!isSignedIn || !configured || !db) {
      setLiveAllItems([]);
      setCollectionChecked(false);
      setIsCollectionEmpty(false);
      return;
    }

    const collectionRef = collection(db, FIRESTORE_COLLECTION_NAME);
    let activeUnsubscribe: (() => void) | null = null;
    let fallbackTriggered = false;

    const handleAllSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      setIsCollectionEmpty(snapshot.empty);
      setCollectionChecked(true);
      setLiveAllItems(parseSnapshotDocs(snapshot, todayDate));
    };

    const subscribeUnordered = () => {
      activeUnsubscribe = onSnapshot(
        collectionRef,
        handleAllSnapshot,
        (snapErr) => {
          reportStructuredFirestoreError(snapErr, OperationType.LIST, FIRESTORE_COLLECTION_NAME);
          setCollectionChecked(true);
        }
      );
    };

    const orderedAllQuery = query(collectionRef, orderBy('created_at', 'desc'));
    activeUnsubscribe = onSnapshot(
      orderedAllQuery,
      handleAllSnapshot,
      (snapErr) => {
        if (!fallbackTriggered && snapErr.code === 'failed-precondition') {
          fallbackTriggered = true;
          if (activeUnsubscribe) activeUnsubscribe();
          subscribeUnordered();
          return;
        }
        reportStructuredFirestoreError(snapErr, OperationType.LIST, FIRESTORE_COLLECTION_NAME);
        setCollectionChecked(true);
      }
    );

    return () => {
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }, [configured, isSignedIn, todayDate, retryCount]);

  // 3. LIVE ARCHIVE DATE QUERY: where('content_date', '==', selectedArchiveDate) when a specific date is selected
  useEffect(() => {
    if (!isSignedIn || !configured || !db || !selectedArchiveDate) {
      setLiveArchiveDateItems([]);
      setArchiveLoading(false);
      return;
    }

    setArchiveLoading(true);
    const collectionRef = collection(db, FIRESTORE_COLLECTION_NAME);
    let activeUnsubscribe: (() => void) | null = null;
    let fallbackTriggered = false;

    const handleArchiveDateSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      setLiveArchiveDateItems(parseSnapshotDocs(snapshot, selectedArchiveDate));
      setArchiveLoading(false);
    };

    const subscribeWithoutOrderBy = () => {
      const simpleDateQuery = query(
        collectionRef,
        where('content_date', '==', selectedArchiveDate)
      );
      activeUnsubscribe = onSnapshot(
        simpleDateQuery,
        handleArchiveDateSnapshot,
        (snapErr) => {
          reportStructuredFirestoreError(snapErr, OperationType.LIST, FIRESTORE_COLLECTION_NAME);
          setArchiveLoading(false);
        }
      );
    };

    const orderedDateQuery = query(
      collectionRef,
      where('content_date', '==', selectedArchiveDate),
      orderBy('created_at', 'desc')
    );

    activeUnsubscribe = onSnapshot(
      orderedDateQuery,
      handleArchiveDateSnapshot,
      (snapErr) => {
        if (!fallbackTriggered && snapErr.code === 'failed-precondition') {
          fallbackTriggered = true;
          if (activeUnsubscribe) activeUnsubscribe();
          subscribeWithoutOrderBy();
          return;
        }
        reportStructuredFirestoreError(snapErr, OperationType.LIST, FIRESTORE_COLLECTION_NAME);
        setArchiveLoading(false);
      }
    );

    return () => {
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }, [configured, isSignedIn, selectedArchiveDate, retryCount]);

  // Determine whether demo sample data should be displayed
  const isSampleData = !configured || (collectionChecked && isCollectionEmpty);
  const sampleReason: SampleDataReason = !configured
    ? 'unconfigured'
    : collectionChecked && isCollectionEmpty
    ? 'empty_collection'
    : null;

  // Datasets exposed to Today, Archive, and DetailModal
  const todayItems = useMemo(() => {
    if (isSampleData) {
      return sampleItems.filter((item) => item.content_date === todayDate);
    }
    return liveTodayItems;
  }, [isSampleData, sampleItems, todayDate, liveTodayItems]);

  const archiveItems = useMemo(() => {
    if (isSampleData) {
      return selectedArchiveDate
        ? sampleItems.filter((item) => item.content_date === selectedArchiveDate)
        : sampleItems;
    }
    return selectedArchiveDate ? liveArchiveDateItems : liveAllItems;
  }, [isSampleData, sampleItems, selectedArchiveDate, liveArchiveDateItems, liveAllItems]);

  const allItemsForLookup = useMemo(() => {
    if (isSampleData) {
      return sampleItems;
    }
    const merged = new Map<string, AggregatorContentItem>();
    for (const item of liveAllItems) merged.set(item.id, item);
    for (const item of liveTodayItems) merged.set(item.id, item);
    for (const item of liveArchiveDateItems) merged.set(item.id, item);
    return Array.from(merged.values());
  }, [isSampleData, sampleItems, liveAllItems, liveTodayItems, liveArchiveDateItems]);

  const availableDates: DateCountOption[] = useMemo(() => {
    const source = isSampleData ? sampleItems : liveAllItems;
    return getAvailableDates(source);
  }, [isSampleData, sampleItems, liveAllItems]);

  const totalAllDaysCount = isSampleData ? sampleItems.length : liveAllItems.length;

  // STATUS-ONLY UPDATE: updates ONLY { status } field via updateDoc, never touches other fields
  const updateItemStatus = useCallback(
    async (
      itemId: string,
      nextStatus: ContentStatus
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!isValidContentStatus(nextStatus)) {
        return { ok: false, error: 'قيمة الحالة غير صالحة.' };
      }

      if (isSampleData || !configured || !db) {
        setSampleItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, status: nextStatus } : item))
        );
        return { ok: true };
      }

      setUpdatingIds((prev) => ({ ...prev, [itemId]: true }));
      try {
        const docRef = doc(db, FIRESTORE_COLLECTION_NAME, itemId);
        // Strictly update ONLY the "status" field (enforced by Firestore Security Rules)
        await updateDoc(docRef, { status: nextStatus });

        const applyOptimistic = (prev: AggregatorContentItem[]) =>
          prev.map((item) => (item.id === itemId ? { ...item, status: nextStatus } : item));
        setLiveTodayItems(applyOptimistic);
        setLiveArchiveDateItems(applyOptimistic);
        setLiveAllItems(applyOptimistic);

        return { ok: true };
      } catch (err) {
        reportStructuredFirestoreError(
          err,
          OperationType.UPDATE,
          `${FIRESTORE_COLLECTION_NAME}/${itemId}`
        );
        return {
          ok: false,
          error: translateFirestoreUpdateError(err),
        };
      } finally {
        setUpdatingIds((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }
    },
    [configured, isSampleData]
  );

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return {
    todayItems,
    archiveItems,
    allItemsForLookup,
    availableDates,
    totalAllDaysCount,
    loading: todayLoading,
    archiveLoading: configured && !isSampleData ? archiveLoading : false,
    error,
    isSampleData,
    sampleReason,
    updatingIds,
    updateItemStatus,
    retry,
  };
}
