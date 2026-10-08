import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authHeader,
  buildTestApp,
  readError,
  seedFighter,
  truncateAll,
  type TestHarness,
} from "../helpers/app.js";

let harness: TestHarness;

beforeEach(async () => {
  harness = await buildTestApp();
  await truncateAll(harness.database.db);
});

afterEach(async () => {
  await harness.close();
});

async function sendRequest(
  senderToken: string,
  receiverId: string,
  overrides: Record<string, unknown> = {},
) {
  return harness.app.inject({
    method: "POST",
    url: "/api/v1/sparring",
    headers: { authorization: `Bearer ${senderToken}` },
    payload: {
      receiverId,
      discipline: "boxing",
      proposedDate: new Date(Date.now() + 86_400_000).toISOString(),
      proposedLocation: "Iron Fist MMA",
      message: "Looking for rounds",
      ...overrides,
    },
  });
}

describe("sparring requests", () => {
  it("creates a request, prevents self-requests and duplicates", async () => {
    const a = await seedFighter(harness.app, "+919833000001", { name: "Sender A" });
    const b = await seedFighter(harness.app, "+919833000002", { name: "Receiver B" });

    const created = await sendRequest(a.session.token, b.profile.id);
    expect(created.statusCode).toBe(201);
    expect(created.json().match.status).toBe("pending");

    const self = await sendRequest(a.session.token, a.profile.id);
    expect(self.statusCode).toBe(400);
    expect(readError(self.body).code).toBe("CANNOT_REQUEST_SELF");

    const duplicate = await sendRequest(a.session.token, b.profile.id);
    expect(duplicate.statusCode).toBe(409);
    expect(readError(duplicate.body).code).toBe("DUPLICATE_REQUEST");

    const reverse = await sendRequest(b.session.token, a.profile.id);
    expect(reverse.statusCode).toBe(409);
  });

  it("rejects requests in the past", async () => {
    const a = await seedFighter(harness.app, "+919833000003", { name: "Past Sender" });
    const b = await seedFighter(harness.app, "+919833000004", { name: "Past Receiver" });
    const response = await sendRequest(a.session.token, b.profile.id, {
      proposedDate: new Date(Date.now() - 86_400_000).toISOString(),
    });
    expect(response.statusCode).toBe(400);
  });

  it("only the receiver can accept or decline", async () => {
    const a = await seedFighter(harness.app, "+919833000005", { name: "Acceptor Sender" });
    const b = await seedFighter(harness.app, "+919833000006", { name: "Acceptor Receiver" });
    const created = (await sendRequest(a.session.token, b.profile.id)).json().match;

    const senderAccepts = await harness.app.inject({
      method: "PATCH",
      url: `/api/v1/matches/${created.id}/status`,
      headers: authHeader(a.session),
      payload: { status: "accepted" },
    });
    expect(senderAccepts.statusCode).toBe(409);

    const accepted = await harness.app.inject({
      method: "PATCH",
      url: `/api/v1/matches/${created.id}/status`,
      headers: authHeader(b.session),
      payload: { status: "accepted" },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().match.status).toBe("accepted");
  });

  it("enforces the status state machine", async () => {
    const a = await seedFighter(harness.app, "+919833000007", { name: "State Sender" });
    const b = await seedFighter(harness.app, "+919833000008", { name: "State Receiver" });
    const created = (await sendRequest(a.session.token, b.profile.id)).json().match;

    const decline = await harness.app.inject({
      method: "PATCH",
      url: `/api/v1/matches/${created.id}/status`,
      headers: authHeader(b.session),
      payload: { status: "declined" },
    });
    expect(decline.statusCode).toBe(200);

    const acceptAfterDecline = await harness.app.inject({
      method: "PATCH",
      url: `/api/v1/matches/${created.id}/status`,
      headers: authHeader(b.session),
      payload: { status: "accepted" },
    });
    expect(acceptAfterDecline.statusCode).toBe(409);
    expect(readError(acceptAfterDecline.body).code).toBe("MATCH_INVALID_TRANSITION");
  });

  it("lets the sender cancel a pending request and lists tabs correctly", async () => {
    const a = await seedFighter(harness.app, "+919833000009", { name: "Tab Sender" });
    const b = await seedFighter(harness.app, "+919833000010", { name: "Tab Receiver" });
    await sendRequest(a.session.token, b.profile.id);

    const received = await harness.app.inject({
      method: "GET",
      url: "/api/v1/matches?tab=received",
      headers: authHeader(b.session),
    });
    expect(received.json().items.length).toBe(1);

    const sent = await harness.app.inject({
      method: "GET",
      url: "/api/v1/matches?tab=sent",
      headers: authHeader(a.session),
    });
    expect(sent.json().items.length).toBe(1);

    const matchId = sent.json().items[0].id;
    const cancel = await harness.app.inject({
      method: "PATCH",
      url: `/api/v1/matches/${matchId}/status`,
      headers: authHeader(a.session),
      payload: { status: "cancelled" },
    });
    expect(cancel.statusCode).toBe(200);
  });

  it("does not expose matches to non-participants", async () => {
    const a = await seedFighter(harness.app, "+919833000011", { name: "Private A" });
    const b = await seedFighter(harness.app, "+919833000012", { name: "Private B" });
    const c = await seedFighter(harness.app, "+919833000013", { name: "Nosy C" });
    const created = (await sendRequest(a.session.token, b.profile.id)).json().match;

    const response = await harness.app.inject({
      method: "GET",
      url: `/api/v1/matches/${created.id}`,
      headers: authHeader(c.session),
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("chat", () => {
  it("blocks chat until the request is accepted, then allows participants only", async () => {
    const a = await seedFighter(harness.app, "+919833000014", { name: "Chat A" });
    const b = await seedFighter(harness.app, "+919833000015", { name: "Chat B" });
    const c = await seedFighter(harness.app, "+919833000016", { name: "Chat C" });
    const created = (await sendRequest(a.session.token, b.profile.id)).json().match;

    const beforeAccept = await harness.app.inject({
      method: "POST",
      url: `/api/v1/messages/${created.id}`,
      headers: authHeader(a.session),
      payload: { content: "Hi" },
    });
    expect(beforeAccept.statusCode).toBe(409);
    expect(readError(beforeAccept.body).code).toBe("MATCH_NOT_ACCEPTED");

    await harness.app.inject({
      method: "PATCH",
      url: `/api/v1/matches/${created.id}/status`,
      headers: authHeader(b.session),
      payload: { status: "accepted" },
    });

    const sent = await harness.app.inject({
      method: "POST",
      url: `/api/v1/messages/${created.id}`,
      headers: authHeader(a.session),
      payload: { content: "Ready for 7am?" },
    });
    expect(sent.statusCode).toBe(201);

    const outside = await harness.app.inject({
      method: "GET",
      url: `/api/v1/messages/${created.id}`,
      headers: authHeader(c.session),
    });
    expect(outside.statusCode).toBe(404);

    const history = await harness.app.inject({
      method: "GET",
      url: `/api/v1/messages/${created.id}`,
      headers: authHeader(b.session),
    });
    expect(history.json().items.length).toBe(1);

    const read = await harness.app.inject({
      method: "POST",
      url: `/api/v1/messages/${created.id}/read`,
      headers: authHeader(b.session),
    });
    expect(read.json().updated).toBe(1);

    const empty = await harness.app.inject({
      method: "POST",
      url: `/api/v1/messages/${created.id}`,
      headers: authHeader(a.session),
      payload: { content: "   " },
    });
    expect(empty.statusCode).toBe(409);
  });

  it("paginates message history with cursors", async () => {
    const a = await seedFighter(harness.app, "+919833000017", { name: "Pager A" });
    const b = await seedFighter(harness.app, "+919833000018", { name: "Pager B" });
    const created = (await sendRequest(a.session.token, b.profile.id)).json().match;
    await harness.app.inject({
      method: "PATCH",
      url: `/api/v1/matches/${created.id}/status`,
      headers: authHeader(b.session),
      payload: { status: "accepted" },
    });
    for (let i = 0; i < 5; i += 1) {
      await harness.app.inject({
        method: "POST",
        url: `/api/v1/messages/${created.id}`,
        headers: authHeader(a.session),
        payload: { content: `Message ${i}` },
      });
    }
    const firstPage = await harness.app.inject({
      method: "GET",
      url: `/api/v1/messages/${created.id}?limit=2`,
      headers: authHeader(a.session),
    });
    expect(firstPage.json().items.length).toBe(2);
    expect(firstPage.json().nextCursor).toBeTruthy();

    const secondPage = await harness.app.inject({
      method: "GET",
      url: `/api/v1/messages/${created.id}?limit=2&cursor=${firstPage.json().nextCursor}`,
      headers: authHeader(a.session),
    });
    expect(secondPage.json().items.length).toBe(2);
    expect(secondPage.json().items[0].id).not.toBe(firstPage.json().items[0].id);
  });
});
