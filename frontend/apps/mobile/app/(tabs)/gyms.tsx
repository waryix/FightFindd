import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChipRow, EmptyState, ErrorState, LoadingState, Screen } from "@fightfind/ui";
import { DISCIPLINES, GYM_SORT_OPTIONS, type GymSort } from "@fightfind/types";
import { api } from "../../src/api/client";
import { errorMessage } from "../../src/api/errors";
import { GymCard } from "../../src/components/GymCard";
import { LocationPrompt } from "../../src/components/LocationPrompt";
import { HeaderWithSearch } from "../../src/components/HeaderWithSearch";
import { DEFAULT_GYM_FILTERS, GymFilters, countGymFilters, type GymFiltersState } from "../../src/components/GymFilters";
import { useDeviceLocation } from "../../src/location/use-location";
import { track } from "../../src/analytics";

const SORT_LABELS: Record<GymSort, string> = {
  nearest: "Nearest",
  most_relevant: "Most Relevant",
  lowest_fee: "Lowest Fee",
  highest_rated: "Highest Rated",
};

export default function GymsScreen() {
  const router = useRouter();
  const location = useDeviceLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [discipline, setDiscipline] = useState<string | null>(null);
  const [sort, setSort] = useState<GymSort>("most_relevant");
  const [filters, setFilters] = useState<GymFiltersState>(DEFAULT_GYM_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [locationDismissed, setLocationDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 450);
    return () => clearTimeout(timer);
  }, [search]);

  const useLocation = Boolean(location.coords);
  const useLocationAnywhere = !useLocation && Boolean(filters.city);
  const activeFilters = countGymFilters(filters);

  const query = useInfiniteQuery({
    queryKey: ["gyms", { debouncedSearch, discipline, sort, filters, coords: location.coords }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.gyms.discover({
        lat: useLocation ? location.coords!.lat : undefined,
        lng: useLocation ? location.coords!.lng : undefined,
        radiusKm: useLocation ? 50 : undefined,
        search: debouncedSearch || undefined,
        city: filters.city || undefined,
        discipline: (discipline as never) ?? undefined,
        hasTrial: filters.trialOnly || undefined,
        verifiedOnly: filters.verifiedOnly || undefined,
        maxFeePaise: filters.maxFeeRupees ? Number(filters.maxFeeRupees) * 100 : undefined,
        sort: useLocation || sort !== "nearest" ? sort : "most_relevant",
        cursor: pageParam,
        limit: 20,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const gyms = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  const chips = (
    <View style={styles.chipsBlock}>
      <ChipRow
        options={GYM_SORT_OPTIONS}
        value={sort}
        onChange={(value) => setSort(value ?? "most_relevant")}
        labels={SORT_LABELS}
        contentPadding={0}
      />
      <ChipRow options={DISCIPLINES} value={discipline as never} onChange={setDiscipline} includeAll contentPadding={0} />
    </View>
  );

  const showLocationPrompt = !useLocation && !locationDismissed && !useLocationAnywhere;

  return (
    <Screen>
      <HeaderWithSearch
        title="Gyms"
        subtitle="Boxing, MMA and combat sports gyms near you"
        searchValue={search}
        onChangeSearch={setSearch}
        searchPlaceholder="Search…"
        filterCount={activeFilters}
        onOpenFilters={() => setShowFilters(true)}
      />

      {showLocationPrompt ? (
        <View style={styles.promptWrap}>
          <LocationPrompt
            title="Find gyms near you"
            message="FightFind uses your location only to find nearby fighters and gyms."
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
          <LoadingState message="Finding gyms…" />
        </>
      ) : query.isError ? (
        <>
          <View style={styles.chipsWrap}>{chips}</View>
          <ErrorState message="Couldn't load gyms" detail={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        </>
      ) : gyms.length === 0 ? (
        <>
          <View style={styles.chipsWrap}>{chips}</View>
          <EmptyState
            title="No gyms found"
            message="Try a different city, discipline or clear the filters."
            actionTitle="Refresh"
            onAction={() => void query.refetch()}
          />
        </>
      ) : (
        <FlatList
          data={gyms}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={chips}
          renderItem={({ item }) => (
            <GymCard
              gym={item}
              onPress={() => {
                track("gym_viewed", { gymId: item.id });
                router.push({ pathname: "/(tabs)/gym/[gymId]", params: { gymId: item.id } });
              }}
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
        />
      )}

      <GymFilters visible={showFilters} filters={filters} onChange={setFilters} onClose={() => setShowFilters(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipsBlock: { gap: 2 },
  chipsWrap: { paddingHorizontal: 16 },
  promptWrap: { paddingHorizontal: 16, paddingTop: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
});
