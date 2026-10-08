"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DISCIPLINES } from "@fightfind/types";
import { api } from "../../../../src/lib/api";
import { Button, Card, ErrorState, Field, LoadingState, SectionTitle, inputClass } from "../../../../src/components/ui";

export default function GymProfilePage() {
  const queryClient = useQueryClient();
  const gymsQuery = useQuery({ queryKey: ["owner-gyms"], queryFn: () => api.gymOwner.listGyms() });
  const gym = gymsQuery.data?.gyms[0] ?? null;

  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    timings: "",
    feeRupees: "",
    hasTrialClass: false,
    phone: "",
    email: "",
    latitude: "",
    longitude: "",
    disciplines: [] as string[],
  });

  useEffect(() => {
    if (!gym) return;
    setForm({
      name: gym.name,
      description: gym.description ?? "",
      address: gym.address,
      city: gym.city,
      state: gym.state,
      pincode: gym.pincode ?? "",
      timings: gym.timings ?? "",
      feeRupees: gym.monthlyFeePaise ? String(gym.monthlyFeePaise / 100) : "",
      hasTrialClass: gym.hasTrialClass,
      phone: gym.phone?.replace("+91", "") ?? "",
      email: gym.email ?? "",
      latitude: gym.latitude ? String(gym.latitude) : "",
      longitude: gym.longitude ? String(gym.longitude) : "",
      disciplines: gym.disciplines as string[],
    });
  }, [gym]);

  const update = useMutation({
    mutationFn: () =>
      api.gymOwner.updateGym(gym!.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim() || null,
        timings: form.timings.trim() || null,
        monthlyFeePaise: form.feeRupees ? Math.round(Number(form.feeRupees) * 100) : null,
        hasTrialClass: form.hasTrialClass,
        phone: form.phone.replace(/\D/g, "").slice(-10) || undefined,
        email: form.email.trim() || undefined,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        disciplines: form.disciplines as never[],
      }),
    onSuccess: () => {
      setSaved("Profile saved.");
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["owner-gyms"] });
      void queryClient.invalidateQueries({ queryKey: ["onboarding"] });
    },
    onError: (err) => {
      setSaved("");
      setError(err instanceof Error ? err.message : "Could not save profile.");
    },
  });

  const handlePhoto = async (file: File | null) => {
    if (!file || !gym) return;
    setUploading(true);
    setError("");
    try {
      await api.gymOwner.uploadGymPhoto(gym.id, { file, name: file.name, type: file.type });
      await queryClient.invalidateQueries({ queryKey: ["owner-gyms"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (gymsQuery.isPending) return <LoadingState message="Loading gym profile…" />;
  if (gymsQuery.isError || !gym) {
    return (
      <ErrorState
        message="Couldn't load your gym"
        detail={gymsQuery.error instanceof Error ? gymsQuery.error.message : undefined}
        onRetry={() => void gymsQuery.refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Gym Profile</h1>
        <p className="text-sm text-muted">This is what fighters see in the FightFind app.</p>
      </div>

      {saved ? <p className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">{saved}</p> : null}
      {error ? <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <Card className="space-y-4">
        <SectionTitle>Photos</SectionTitle>
        <div className="flex flex-wrap gap-3">
          {gym.photoUrls.map((url) => (
            <img key={url} src={url} alt={`${gym.name} photo`} className="h-24 w-32 rounded-xl border border-border object-cover" />
          ))}
          <label className="flex h-24 w-32 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted hover:border-primary">
            {uploading ? "Uploading…" : "+ Add photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handlePhoto(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <p className="text-xs text-muted">Up to 12 photos. The first photo becomes the cover image.</p>
      </Card>

      <Card className="space-y-4">
        <SectionTitle>Details</SectionTitle>
        <Field label="Gym name">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea
            className={`${inputClass} min-h-28`}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Disciplines">
          <div className="flex flex-wrap gap-2">
            {DISCIPLINES.map((discipline) => (
              <button
                key={discipline}
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    disciplines: prev.disciplines.includes(discipline)
                      ? prev.disciplines.filter((d) => d !== discipline)
                      : [...prev.disciplines, discipline],
                  }))
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${
                  form.disciplines.includes(discipline) ? "border-primary bg-primary text-white" : "border-border text-muted"
                }`}
              >
                {discipline.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monthly fee (₹)">
            <input className={inputClass} value={form.feeRupees} inputMode="decimal" onChange={(e) => setForm({ ...form, feeRupees: e.target.value })} />
          </Field>
          <Field label="Timings">
            <input className={inputClass} value={form.timings} onChange={(e) => setForm({ ...form, timings: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </div>
        <Field label="Free trial class">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={form.hasTrialClass}
              onChange={(e) => setForm({ ...form, hasTrialClass: e.target.checked })}
            />
            Offer a free trial class
          </label>
        </Field>
      </Card>

      <Card className="space-y-4">
        <SectionTitle>Location</SectionTitle>
        <Field label="Address">
          <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City">
            <input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="State">
            <input className={inputClass} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </Field>
          <Field label="Pincode">
            <input className={inputClass} value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
          </Field>
          <Field label="Latitude">
            <input className={inputClass} value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
          </Field>
          <Field label="Longitude">
            <input className={inputClass} value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-muted">
          Changing your bank/payout account is not done here — start a payout-account update through Razorpay from
          Settings to keep payment identity controlled.
        </p>
      </Card>

      <Button onClick={() => update.mutate()} loading={update.isPending} className="w-full">
        Save profile
      </Button>
    </div>
  );
}
