import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChipRow, EmptyState, ErrorState, LoadingState, Screen, AppText } from "@fightfind/ui";
import { DISCIPLINES, type DiscoverySort } from "@fightfind/types";
import { api } from "../../src/api/client";
import { errorMessage } from "../../src/api/errors";
import { FighterCard } from "../../src/components/FighterCard";
import { LocationPrompt } from "../../src/components/LocationPrompt";
import { HeaderWithSearch } from "../../src/components/HeaderWithSearch";
import {
  DEFAULT_DISCOVER_FILTERS,
  DiscoverFilters,
  countActiveFilters,
  type DiscoverFiltersState,
} from "../../src/components/DiscoverFilters";
import { useAuth } from "../../src/auth/auth-context";
import { useRequireAccount } from "../../src/auth/use-require-account";
import { useDeviceLocation } from "../../src/location/use-location";
import { track } from "../../src/analytics";

const SORTS: { key: DiscoverySort; label: string }[] = [
  { key: "best_match", label: "Best Match" },
  { key: "nearest", label: "Nearest" },
  { key: "most_experienced", label: "Most Experienced" },
  { key: "recently_active", label: "Recently Active" },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const { isPremium } = useAuth();
  const requireAccount = useRequireAccount();
  const location = useDeviceLocation();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<DiscoverFiltersState>(DEFAULT_DISCOVER_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [locationDismissed, setLocationDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 450);
    return () => clearTimeout(timer);
  }, [search]);

  const useLocation = Boolean(location.coords);
  const useLocationAnywhere = !useLocation && Boolean(filters.city);

  const query = useInfiniteQuery({
    queryKey: ["fighters", { filters, search: debouncedSearch, coords: location.coords, useLocation }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.fighters.discover({
        lat: useLocation ? location.coords!.lat : undefined,
        lng: useLocation ? location.coords!.lng : undefined,
        radiusKm: useLocation ? (filters.radiusKm ?? undefined) : undefined,
        city: filters.city || undefined,
        discipline: filters.discipline ?? undefined,
        skill: filters.skill ?? undefined,
        weightClass: filters.weightClass ?? undefined,
        search: debouncedSearch || undefined,
        sort: useLocation || filters.sort !== "nearest" ? filters.sort : "best_match",
        cursor: pageParam,
        limit: 20,
        ...(isPremium
          ? {
              minHeight: filters.minHeight ? Number(filters.minHeight) : undefined,
              maxHeight: filters.maxHeight ? Number(filters.maxHeight) : undefined,
              minWeight: filters.minWeight ? Number(filters.minWeight) : undefined,
              maxWeight: filters.maxWeight ? Number(filters.maxWeight) : undefined,
              minExperience: filters.minExperience ? Number(filters.minExperience) : undefined,
              maxExperience: filters.maxExperience ? Number(filters.maxExperience) : undefined,
              minFights: filters.minFights ? Number(filters.minFights) : undefined,
              maxFights: filters.maxFights ? Number(filters.maxFights) : undefined,
            }
          : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const fighters = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const activeFilters = countActiveFilters(filters);

  const handleRequest = useCallback(
    (fighter: (typeof fighters)[number]) => {
      requireAccount(() => {
        track("sparring_request_started", { receiverId: fighter.id });
        router.push({
          pathname: "/(tabs)/request/[receiverId]",
          params: {
            receiverId: fighter.id,
            receiverName: fighter.name,
            receiverSkill: fighter.skillLevel,
            receiverDisciplines: JSON.stringify(fighter.disciplines),
          },
        });
      }, "Create a free Fighter account to send sparring requests.");
    },
    [requireAccount, router],
  );

  const chips = (
    <View style={styles.chipsBlock}>
      <ChipRow
        options={SORTS.map((sort) => sort.key)}
        value={filters.sort}
        onChange={(value) => setFilters((prev) => ({ ...prev, sort: value ?? "best_match" }))}
        labels={Object.fromEntries(SORTS.map((sort) => [sort.key, sort.label])) as Record<DiscoverySort, string>}
        contentPadding={0}
      />
      <ChipRow
        options={DISCIPLINES}
        value={filters.discipline}
        onChange={(value) => setFilters((prev) => ({ ...prev, discipline: value }))}
        includeAll
        contentPadding={0}
      />
    </View>
  );

  const showLocationPrompt = !useLocation && !locationDismissed && !useLocationAnywhere;

  return (
    <Screen>
      <HeaderWithSearch
        title="Discover"
        subtitle={
          useLocation && filters.radiusKm
            ? `Within ${filters.radiusKm} km of you`
            : useLocation
              ? "Sorted around your location"
              : "Find sparring partners"
        }
        searchValue={search}
        onChangeSearch={setSearch}
        searchPlaceholder="Search…"
        filterCount={activeFilters}
        onOpenFilters={() => setShowFilters(true)}
      />

      {showLocationPrompt ? (
        <View style={styles.promptWrap}>
          <LocationPrompt
            title="Find fighters near you"
            message="FightFind uses your location only to find nearby fighters and gyms. You can always browse by city instead."
            loading={location.loading}
            denied={location.status === "denied"}
            onAllow={() => void location.request()}
            onDismiss={() => setLocationDismissed(true)}
          />
        </View>
      ) : null}

      {query.isPending ? (
        <>
          <View style={styles.chipsWrap}>{chips}</View>
          <LoadingState message="Finding fighters…" />
        </>
      ) : query.isError ? (
        <>
          <View style={styles.chipsWrap}>{chips}</View>
          <ErrorState message="Couldn't load fighters" detail={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        </>
      ) : fighters.length === 0 ? (
        <>
          <View style={styles.chipsWrap}>{chips}</View>
          <EmptyState
            title="No fighters found"
            message="Try increasing your radius, clearing filters or searching another city."
            actionTitle="Clear filters"
            onAction={() => setFilters(DEFAULT_DISCOVER_FILTERS)}
          />
        </>
      ) : (
        <FlatList
          data={fighters}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={chips}
          renderItem={({ item }) => (
            <FighterCard
              fighter={item}
              onPress={() => router.push({ pathname: "/(tabs)/fighter/[fighterId]", params: { fighterId: item.id } })}
              onRequest={() => handleRequest(item)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <AppText variant="caption" center style={styles.footerText}>
                Loading more…
              </AppText>
            ) : null
          }
        />
      )}

      <DiscoverFilters
        visible={showFilters}
        filters={filters}
        isPremium={isPremium}
        onChange={setFilters}
        onClose={() => setShowFilters(false)}
        onUpgrade={() => {
          setShowFilters(false);
          router.push("/(tabs)/premium");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipsBlock: { gap: 2 },
  chipsWrap: { paddingHorizontal: 16 },
  promptWrap: { paddingHorizontal: 16, paddingTop: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  footerText: { paddingVertical: 16 },
});
