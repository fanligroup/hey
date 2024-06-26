import type { AnyPublication, PublicationsRequest } from '@hey/lens';
import type { FC } from 'react';
import type { StateSnapshot, VirtuosoHandle } from 'react-virtuoso';

import SinglePublication from '@components/Publication/SinglePublication';
import PublicationsShimmer from '@components/Shared/Shimmer/PublicationsShimmer';
import {
  PaperAirplaneIcon,
  RectangleStackIcon
} from '@heroicons/react/24/outline';
import {
  LimitType,
  PublicationMetadataMainFocusType,
  PublicationType,
  usePublicationQuery,
  usePublicationsQuery
} from '@hey/lens';
import { Card, EmptyState, ErrorMessage } from '@hey/ui';
import { useEffect, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { ProfileFeedType } from 'src/enums';
import { useImpressionsStore } from 'src/store/non-persisted/useImpressionsStore';
import { useProfileFeedStore } from 'src/store/non-persisted/useProfileFeedStore';
import { useTipsStore } from 'src/store/non-persisted/useTipsStore';
import { useProfileStore } from 'src/store/persisted/useProfileStore';
import { useTransactionStore } from 'src/store/persisted/useTransactionStore';

let virtuosoState: any = { ranges: [], screenTop: 0 };

interface FeedProps {
  handle: string;
  pinnedPublicationId: null | string;
  profileDetailsLoading: boolean;
  profileId: string;
  type:
    | ProfileFeedType.Collects
    | ProfileFeedType.Feed
    | ProfileFeedType.Media
    | ProfileFeedType.Replies;
}

const Feed: FC<FeedProps> = ({
  handle,
  pinnedPublicationId,
  profileDetailsLoading,
  profileId,
  type
}) => {
  const { currentProfile } = useProfileStore();
  const { mediaFeedFilters } = useProfileFeedStore();
  const { fetchAndStoreViews } = useImpressionsStore();
  const { fetchAndStoreTips } = useTipsStore();
  const { indexedPostHash } = useTransactionStore();
  const virtuoso = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    virtuosoState = { ranges: [], screenTop: 0 };
  }, [profileId, handle]);

  const getMediaFilters = () => {
    const filters: PublicationMetadataMainFocusType[] = [];
    if (mediaFeedFilters.images) {
      filters.push(PublicationMetadataMainFocusType.Image);
    }
    if (mediaFeedFilters.video) {
      filters.push(PublicationMetadataMainFocusType.Video);
    }
    if (mediaFeedFilters.audio) {
      filters.push(PublicationMetadataMainFocusType.Audio);
    }
    return filters;
  };

  // Variables
  const publicationTypes: PublicationType[] =
    type === ProfileFeedType.Feed
      ? [PublicationType.Post, PublicationType.Mirror, PublicationType.Quote]
      : type === ProfileFeedType.Replies
        ? [PublicationType.Comment]
        : type === ProfileFeedType.Media
          ? [
              PublicationType.Post,
              PublicationType.Comment,
              PublicationType.Quote
            ]
          : [
              PublicationType.Post,
              PublicationType.Comment,
              PublicationType.Mirror
            ];
  const metadata =
    type === ProfileFeedType.Media
      ? { mainContentFocus: getMediaFilters() }
      : null;
  const request: PublicationsRequest = {
    limit: LimitType.TwentyFive,
    where: {
      metadata,
      publicationTypes,
      ...(type !== ProfileFeedType.Collects
        ? { from: [profileId] }
        : { actedBy: profileId })
    }
  };

  const { data: pinnedPublicationData, loading: pinnedPublicationLoading } =
    usePublicationQuery({
      skip: !pinnedPublicationId,
      variables: { request: { forId: pinnedPublicationId } }
    });

  const { data, error, fetchMore, loading, refetch } = usePublicationsQuery({
    onCompleted: async ({ publications }) => {
      const ids =
        publications?.items?.map((p) => {
          return p.__typename === 'Mirror' ? p.mirrorOn?.id : p.id;
        }) || [];
      await fetchAndStoreViews(ids);
      await fetchAndStoreTips(ids);
    },
    skip: !profileId,
    variables: { request }
  });

  const publications = data?.publications?.items;
  const pageInfo = data?.publications?.pageInfo;
  const hasMore = pageInfo?.next;

  useEffect(() => {
    if (indexedPostHash && currentProfile?.id === profileId) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexedPostHash]);

  const onScrolling = (scrolling: boolean) => {
    if (!scrolling) {
      virtuoso?.current?.getState((state: StateSnapshot) => {
        virtuosoState = { ...state };
      });
    }
  };

  const onEndReached = async () => {
    if (hasMore) {
      const { data } = await fetchMore({
        variables: { request: { ...request, cursor: pageInfo?.next } }
      });
      const ids =
        data?.publications?.items?.map((p) => {
          return p.__typename === 'Mirror' ? p.mirrorOn?.id : p.id;
        }) || [];
      await fetchAndStoreViews(ids);
      await fetchAndStoreTips(ids);
    }
  };

  if (loading || profileDetailsLoading || pinnedPublicationLoading) {
    return <PublicationsShimmer />;
  }

  if (publications?.length === 0) {
    const emptyMessage =
      type === ProfileFeedType.Feed
        ? 'has nothing in their feed yet!'
        : type === ProfileFeedType.Media
          ? 'has no media yet!'
          : type === ProfileFeedType.Replies
            ? "hasn't replied yet!"
            : type === ProfileFeedType.Collects
              ? "hasn't collected anything yet!"
              : '';

    return (
      <EmptyState
        icon={<RectangleStackIcon className="size-8" />}
        message={
          <div>
            <span className="mr-1 font-bold">{handle}</span>
            <span>{emptyMessage}</span>
          </div>
        }
      />
    );
  }

  if (error) {
    return <ErrorMessage error={error} title="Failed to load profile feed" />;
  }

  return (
    <Card>
      {pinnedPublicationData?.publication ? (
        <>
          <SinglePublication
            header={
              <div className="ld-text-gray-500 mb-5 flex items-center space-x-2">
                <PaperAirplaneIcon className="size-4" />
                <b className="text-sm">
                  Pinned {pinnedPublicationData.publication.__typename}
                </b>
              </div>
            }
            publication={pinnedPublicationData.publication as AnyPublication}
            showThread={false}
          />
          <div className="divider" />
        </>
      ) : null}
      <Virtuoso
        className="virtual-divider-list-window"
        computeItemKey={(index, publication) => `${publication.id}-${index}`}
        data={publications}
        endReached={onEndReached}
        isScrolling={onScrolling}
        itemContent={(index, publication) => (
          <SinglePublication
            isFirst={index === 0}
            isLast={index === (publications?.length || 0) - 1}
            publication={publication as AnyPublication}
            showThread={
              type !== ProfileFeedType.Media &&
              type !== ProfileFeedType.Collects
            }
          />
        )}
        ref={virtuoso}
        restoreStateFrom={
          virtuosoState.ranges.length === 0
            ? virtuosoState?.current?.getState((state: StateSnapshot) => state)
            : virtuosoState
        }
        useWindowScroll
      />
    </Card>
  );
};

export default Feed;
