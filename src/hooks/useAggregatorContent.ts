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
  FIRESTORE_DATES_COLLECTION_NAME,
  isFirebaseConfigured,
} from '../firebase-config';
import type {
  AggregatorContentItem,
  ContentStatus,
  DateCountOption,
} from '../types/content';
import { buildSampleContent } from '../data/sampleContent';
import {
  getAvailableDates,
  isValidContentStatus,
  normalizeDateIndexDocument,
  normalizeFirestoreDocument,
  sortDateCountOptions,
  sortItemsByCreatedAtDesc,
} from '../utils/contentUtils';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { useEgyptTodayDate } from './useEgyptTodayDate';
import type { ActivePage } from '../components/Header';

export type SampleDataReason = 'unconfigured' | 'empty_collection' | null;

type DatesIndexState = 'loading' | 'populated' | 'empty' | 'error';

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
 * Manages live Firestore reads (onSnapshot) and status-only updates for `aggregator_content`
 * and the lightweight `aggregator_dates` index collection.
 * - NEVER creates or deletes documents in Firestore.
 * - Recomputes Africa/Cairo `todayDate` every minute and on tab visibility/focus, resubscribing
 *   the Today query automatically after midnight.
 * - Builds the available-dates sidebar and empty-collection check from `aggregator_dates` without
 *   scanning `aggregator_content`, falling back to `aggregator_content` only if `aggregator_dates`
 *   is empty/missing or when the user views Archive "جميع الأيام".
 */
export function useAggregatorContent(
  isSignedIn: boolean,
  selectedArchiveDate: string,
  activePage: ActivePage
) {
  const configured = isFirebaseConfigured() && db !== null;
  const todayDate = useEgyptTodayDate();

  // Demo/sample fallback state (used when unconfigured or when Firestore collection is completely empty)
  const [sampleItems, setSampleItems] = useState<AggregatorContentItem[]>(() =>
    buildSampleContent()
  );

  // Lightweight dates index state (aggregator_dates)
  const [datesIndexState, setDatesIndexState] = useState<DatesIndexState>('loading');
  const [indexedDates, setIndexedDates] = useState<DateCountOption[]>([]);

  // Live Firestore states for aggregator_content
  const [liveTodayItems, setLiveTodayItems] = useState<AggregatorContentItem[]>([]);
  const [liveArchiveDateItems, setLiveArchiveDateItems] = useState<AggregatorContentItem[]>([]);
  const [liveAllItems, setLiveAllItems] = useState<AggregatorContentItem[]>([]);

  const [todayLoading, setTodayLoading] = useState<boolean>(true);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);
  const [fallbackCollectionChecked, setFallbackCollectionChecked] = useState<boolean>(false);
  const [fallbackCollectionEmpty, setFallbackCollectionEmpty] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
  const [retryCount, setRetryCount] = useState<number>(0);

  // 1. LIGHTWEIGHT DATES INDEX QUERY: subscribe to `aggregator_dates` (1 tiny doc per day)
  useEffect(() => {
    if (!isSignedIn || !configured || !db) {
      setIndexedDates([]);
      setDatesIndexState('loading');
      return;
    }

    setDatesIndexState('loading');
    const datesRef = collection(db, FIRESTORE_DATES_COLLECTION_NAME);

    const unsubscribe = onSnapshot(
      datesRef,
      (snapshot) => {
        if (snapshot.empty) {
          setIndexedDates([]);
          setDatesIndexState('empty');
          return;
        }

        const parsed: DateCountOption[] = [];
        for (const docSnap of snapshot.docs) {
          const item = normalizeDateIndexDocument(
            docSnap.id,
            docSnap.data() as Record<string, unknown> | undefined
          );
          if (item) {
            parsed.push(item);
          }
        }

        const sorted = sortDateCountOptions(parsed);
        if (sorted.length === 0) {
          setIndexedDates([]);
          setDatesIndexState('empty');
          return;
        }

        setIndexedDates(sorted);
        setDatesIndexState('populated');
      },
      (snapErr) => {
        // If aggregator_dates is unavailable or rules block it, silently fall back to scanning aggregator_content
        reportStructuredFirestoreError(
          snapErr,
          OperationType.LIST,
          FIRESTORE_DATES_COLLECTION_NAME
        );
        setIndexedDates([]);
        setDatesIndexState('error');
      }
    );

    return () => unsubscribe();
  }, [configured, isSignedIn, retryCount]);

  // 2. LIVE TODAY QUERY: where('content_date', '==', todayDate) + orderBy('created_at', 'desc')
  // Automatically resubscribes whenever `todayDate` rolls over at Africa/Cairo midnight.
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
          reportStructuredFirestoreError(
            snapErr,
            OperationType.LIST,
            FIRESTORE_COLLECTION_NAME
          );
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
        reportStructuredFirestoreError(
          snapErr,
          OperationType.LIST,
          FIRESTORE_COLLECTION_NAME
        );
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

  // 3. CONDITIONAL FALLBACK / ALL-DAYS LISTENER on `aggregator_content`
  // Only attaches when:
  // (a) `aggregator_dates` is empty or errored (fallback so nothing breaks), OR
  // (b) The user is explicitly viewing Archive in "جميع الأيام" mode (selectedArchiveDate === '').
  const needsAllContentListener =
    isSignedIn &&
    configured &&
    db !== null &&
    (datesIndexState === 'empty' ||
      datesIndexState === 'error' ||
      (activePage === 'archive' && selectedArchiveDate === ''));

  useEffect(() => {
    if (!needsAllContentListener || !db) {
      if (datesIndexState === 'populated') {
        setFallbackCollectionChecked(false);
        setFallbackCollectionEmpty(false);
      }
      if (!isSignedIn || !configured) {
        setLiveAllItems([]);
        setFallbackCollectionChecked(false);
        setFallbackCollectionEmpty(false);
      }
      return;
    }

    const isArchiveAllView = activePage === 'archive' && selectedArchiveDate === '';
    if (isArchiveAllView) {
      setArchiveLoading(true);
    }

    const collectionRef = collection(db, FIRESTORE_COLLECTION_NAME);
    let activeUnsubscribe: (() => void) | null = null;
    let fallbackTriggered = false;

    const handleAllSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      setFallbackCollectionEmpty(snapshot.empty);
      setFallbackCollectionChecked(true);
      setLiveAllItems(parseSnapshotDocs(snapshot, todayDate));
      if (isArchiveAllView) {
        setArchiveLoading(false);
      }
    };

    const subscribeUnordered = () => {
      activeUnsubscribe = onSnapshot(
        collectionRef,
        handleAllSnapshot,
        (snapErr) => {
          reportStructuredFirestoreError(
            snapErr,
            OperationType.LIST,
            FIRESTORE_COLLECTION_NAME
          );
          setFallbackCollectionChecked(true);
          if (isArchiveAllView) {
            setArchiveLoading(false);
          }
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
        reportStructuredFirestoreError(
          snapErr,
          OperationType.LIST,
          FIRESTORE_COLLECTION_NAME
        );
        setFallbackCollectionChecked(true);
        if (isArchiveAllView) {
          setArchiveLoading(false);
        }
      }
    );

    return () => {
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }, [
    needsAllContentListener,
    configured,
    isSignedIn,
    todayDate,
    retryCount,
    datesIndexState,
    activePage,
    selectedArchiveDate,
  ]);

  // 4. LIVE ARCHIVE DATE QUERY: where('content_date', '==', selectedArchiveDate) when a specific date is chosen
  useEffect(() => {
    if (!isSignedIn || !configured || !db || !selectedArchiveDate) {
      setLiveArchiveDateItems([]);
      if (selectedArchiveDate === '' && activePage !== 'archive') {
        setArchiveLoading(false);
      }
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
          reportStructuredFirestoreError(
            snapErr,
            OperationType.LIST,
            FIRESTORE_COLLECTION_NAME
          );
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
        reportStructuredFirestoreError(
          snapErr,
          OperationType.LIST,
          FIRESTORE_COLLECTION_NAME
        );
        setArchiveLoading(false);
      }
    );

    return () => {
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }, [configured, isSignedIn, selectedArchiveDate, activePage, retryCount]);

  // Empty-collection check: prefer aggregator_dates index; fall back to aggregator_content only if index is empty/missing
  const isCollectionEmpty =
    datesIndexState === 'populated'
      ? false
      : fallbackCollectionChecked && fallbackCollectionEmpty;

  const isSampleData = !configured || isCollectionEmpty;
  const sampleReason: SampleDataReason = !configured
    ? 'unconfigured'
    : isCollectionEmpty
    ? 'empty_collection'
    : null;

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
    if (isSampleData) {
      return getAvailableDates(sampleItems);
    }
    if (datesIndexState === 'populated') {
      return indexedDates;
    }
    return getAvailableDates(liveAllItems);
  }, [isSampleData, sampleItems, datesIndexState, indexedDates, liveAllItems]);

  const totalAllDaysCount = useMemo(() => {
    if (isSampleData) {
      return sampleItems.length;
    }
    if (datesIndexState === 'populated') {
      return indexedDates.reduce((sum, entry) => sum + entry.count, 0);
    }
    return liveAllItems.length;
  }, [isSampleData, sampleItems, datesIndexState, indexedDates, liveAllItems]);

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
    todayDate,
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
