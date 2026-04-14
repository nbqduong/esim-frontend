<template>
  <div class="community-page">
    <section class="community-hero">
      <div class="community-hero__content">
          <h1 class="community-hero__title">Simbolt community</h1>

          <article class="community-stat-card">
            <a
              class="community-stat-card__label"
              href="https://discord.gg/mtXujZ4S"
              target="_blank"
              rel="noreferrer"
            >
              Discord community
            </a>
            <p class="community-stat-card__copy">
              Bug reports, and quick triage with the team.
            </p>
            <a
              class="community-button community-stat-card__action"
              href="https://discord.gg/mtXujZ4S"
              target="_blank"
              rel="noreferrer"
            >
              Join Discord
            </a>
          </article>
      </div>
    </section>

    <section class="community-grid">
      <article class="community-card community-card--submit">
        <div class="community-card__header community-card__header--center">
            <h2 class="community-card__title">
              Tell us what you need
            </h2>
        </div>
        <div v-if="noticeMessage" class="community-notice" :class="`community-notice--${noticeTone}`">
          {{ noticeMessage }}
        </div>

        <div v-if="viewer" class="community-form__meta">
          <span class="community-form__meta-label">Posting as</span>
          <strong>{{ viewer.display_name || viewer.email }}</strong>
        </div>
        <div v-else class="community-auth-prompt">
          <p class="community-auth-prompt__copy">Login to upvote and submit your ideas</p>
          <button
            class="btn btn-outline-dark d-inline-flex align-items-center justify-content-center community-auth-prompt__button"
            type="button"
            @click="loginWithGoogle"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google Logo"
              class="community-auth-prompt__google-logo"
            >
            Login with Google
          </button>
        </div>

        <form class="community-form" @submit.prevent="submitTicket">
          <label class="community-form__field">
            <span>Feature title</span>
            <input
              v-model.trim="draftTitle"
              type="text"
              maxlength="120"
              placeholder="Example: Add version history for templates"
              :disabled="!viewer || formSubmitting"
            />
          </label>
          <label class="community-form__field">
            <span>Description</span>
            <textarea
              v-model.trim="draftDescription"
              rows="4"
              maxlength="2000"
              placeholder="Describe the problem, who it helps, and what a successful solution looks like."
              :disabled="!viewer || formSubmitting"
            />
          </label>
          <div class="community-form__footer">
            <div class="community-form__actions">
              <button
                v-if="editingTicketId"
                class="community-button community-button--ghost"
                type="button"
                :disabled="formSubmitting"
                @click="cancelEdit"
              >
                Cancel
              </button>
              <button class="community-button" type="submit" :disabled="!viewer || formSubmitting">
                {{ formSubmitting ? "Saving..." : editingTicketId ? "Save changes" : "Submit idea" }}
              </button>
            </div>
          </div>
        </form>
      </article>
    </section>

    <section class="community-board">
      <div class="community-board__header">
        <div>
          <h2 class="community-board__title">Feature Request Board</h2>
        </div>
      </div>

      <div v-if="loadingTickets" class="community-empty-state">
        Loading tickets...
      </div>
      <div v-else-if="orderedTickets.length === 0" class="community-empty-state">
        No tickets yet. The first public request can set the direction for the next build.
      </div>
      <div v-else class="community-board__list">
        <article
          v-for="ticket in orderedTickets"
          :key="ticket.id"
          class="feature-card"
        >
          <div class="feature-card__votes">
            <span class="feature-card__vote-count">{{ ticket.vote_count }}</span>
            <span class="feature-card__vote-label">upvotes</span>
            <button
              class="community-button feature-card__vote-button"
              :class="{
                'feature-card__vote-button--voted': ticket.has_voted,
                'feature-card__vote-button--login': !viewer,
              }"
              type="button"
              :disabled="isVoteDisabled(ticket)"
              @click="handleVoteAction(ticket)"
            >
              {{ voteButtonLabel(ticket) }}
            </button>
          </div>

          <div class="feature-card__content">
            <div class="feature-card__header">
              <div>
                <div class="feature-card__meta">
                  <span class="feature-card__author">{{ ownerLabel(ticket) }}</span>
                  <span v-if="viewer && ticket.user_id === viewer.id" class="feature-card__chip">Your ticket</span>
                  <span v-else-if="ticket.can_manage && viewer?.is_admin" class="feature-card__chip">Admin editable</span>
                </div>
                <h3 class="feature-card__title">{{ ticket.title }}</h3>
              </div>
              <span v-if="ticket.id === topTicketId" class="feature-card__tag">Top voted</span>
            </div>

            <p class="feature-card__description">{{ ticket.description || "No description provided." }}</p>

            <div class="feature-card__footer">
              <span class="feature-card__timestamp">Updated {{ formatDate(ticket.updated_at) }}</span>
              <div v-if="ticket.can_manage" class="feature-card__actions">
                <button
                  class="feature-card__action"
                  type="button"
                  :disabled="isTicketBusy(ticket.id)"
                  @click="beginEdit(ticket)"
                >
                  Edit
                </button>
                <button
                  class="feature-card__action feature-card__action--danger"
                  type="button"
                  :disabled="isTicketBusy(ticket.id)"
                  @click="deleteTicket(ticket)"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";


defineOptions({ name: "Community" });

interface ViewerProfile {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
}

interface TicketSummary {
  id: string;
  user_id: string;
  title: string;
  description: string;
  vote_count: number;
  owner_email: string;
  owner_display_name: string | null;
  created_at: string;
  updated_at: string;
  has_voted: boolean;
  can_manage: boolean;
}

interface TicketListResponse {
  tickets: TicketSummary[];
}

interface TicketVoteResponse {
  ticket_id: string;
  vote_count: number;
  has_voted: boolean;
  created_new_vote: boolean;
}

const backendBaseUrl =
  window.location.port === "5173"
    ? `http://${window.location.hostname}:8000`
    : window.location.origin;

const viewer = ref<ViewerProfile | null>(null);
const tickets = ref<TicketSummary[]>([]);
const loadingTickets = ref(true);
const formSubmitting = ref(false);
const editingTicketId = ref<string | null>(null);
const draftTitle = ref("");
const draftDescription = ref("");
const noticeMessage = ref("");
const noticeTone = ref<"success" | "error">("success");
const busyTicketIds = reactive<Record<string, boolean>>({});

const orderedTickets = computed(() =>
  [...tickets.value].sort((left, right) => {
    if (right.vote_count !== left.vote_count) {
      return right.vote_count - left.vote_count;
    }
    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  }),
);

const topTicketId = computed(() => orderedTickets.value[0]?.id ?? null);

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function setNotice(message: string, tone: "success" | "error" = "success") {
  noticeMessage.value = message;
  noticeTone.value = tone;
}

function clearNotice() {
  noticeMessage.value = "";
}

function loginWithGoogle() {
  window.location.href = `${backendBaseUrl}/auth/google/login`;
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${backendBaseUrl}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

  const rawBody = await response.text();
  let parsedBody: unknown = null;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  }

  if (!response.ok) {
    const errorMessage =
      parsedBody && typeof parsedBody === "object" && "detail" in parsedBody
        ? String((parsedBody as { detail: string }).detail)
        : `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return parsedBody as T;
}

async function loadViewer() {
  try {
    viewer.value = await apiRequest<ViewerProfile>("/api/users/me");
  } catch (error) {
    viewer.value = null;
  }
}

async function loadTickets() {
  loadingTickets.value = true;
  try {
    const payload = await apiRequest<TicketListResponse>("/api/tickets/");
    tickets.value = payload.tickets;
  } catch (error) {
    console.error(error);
    setNotice("Unable to load tickets from the backend right now.", "error");
  } finally {
    loadingTickets.value = false;
  }
}

function resetForm() {
  editingTicketId.value = null;
  draftTitle.value = "";
  draftDescription.value = "";
}

function beginEdit(ticket: TicketSummary) {
  clearNotice();
  editingTicketId.value = ticket.id;
  draftTitle.value = ticket.title;
  draftDescription.value = ticket.description;
}

function cancelEdit() {
  resetForm();
}

function isTicketBusy(ticketId: string) {
  return Boolean(busyTicketIds[ticketId]);
}

function setTicketBusy(ticketId: string, busy: boolean) {
  busyTicketIds[ticketId] = busy;
}

async function submitTicket() {
  if (!viewer.value) {
    setNotice("Login is required before you can submit a ticket.", "error");
    return;
  }

  if (!draftTitle.value) {
    setNotice("Please add a feature title before submitting.", "error");
    return;
  }

  formSubmitting.value = true;
  clearNotice();

  const payload = JSON.stringify({
    title: draftTitle.value,
    description: draftDescription.value,
  });

  try {
    if (editingTicketId.value) {
      await apiRequest<TicketSummary>(`/api/tickets/${editingTicketId.value}`, {
        method: "PUT",
        body: payload,
      });
      setNotice("Ticket updated.");
    } else {
      await apiRequest<TicketSummary>("/api/tickets/", {
        method: "POST",
        body: payload,
      });
      setNotice("Ticket submitted.");
    }

    resetForm();
    await loadTickets();
  } catch (error) {
    console.error(error);
    setNotice(error instanceof Error ? error.message : "Unable to save the ticket.", "error");
  } finally {
    formSubmitting.value = false;
  }
}

async function deleteTicket(ticket: TicketSummary) {
  if (!window.confirm(`Delete "${ticket.title}"?`)) {
    return;
  }

  setTicketBusy(ticket.id, true);
  clearNotice();

  try {
    await apiRequest<void>(`/api/tickets/${ticket.id}`, { method: "DELETE" });
    if (editingTicketId.value === ticket.id) {
      resetForm();
    }
    tickets.value = tickets.value.filter((item) => item.id !== ticket.id);
    setNotice("Ticket deleted.");
  } catch (error) {
    console.error(error);
    setNotice(error instanceof Error ? error.message : "Unable to delete the ticket.", "error");
  } finally {
    setTicketBusy(ticket.id, false);
  }
}

function isVoteDisabled(ticket: TicketSummary) {
  return isTicketBusy(ticket.id) || (viewer.value !== null && ticket.has_voted);
}

function voteButtonLabel(ticket: TicketSummary) {
  if (!viewer.value) {
    return "Login to upvote";
  }
  if (ticket.has_voted) {
    return "Voted";
  }
  if (isTicketBusy(ticket.id)) {
    return "Saving...";
  }
  return "Upvote";
}

async function handleVoteAction(ticket: TicketSummary) {
  if (!viewer.value) {
    loginWithGoogle();
    return;
  }

  if (ticket.has_voted || isTicketBusy(ticket.id)) {
    return;
  }

  setTicketBusy(ticket.id, true);
  clearNotice();

  try {
    const response = await apiRequest<TicketVoteResponse>(`/api/tickets/${ticket.id}/upvote`, {
      method: "POST",
    });

    tickets.value = tickets.value.map((item) =>
      item.id === ticket.id
        ? {
            ...item,
            vote_count: response.vote_count,
            has_voted: response.has_voted,
          }
        : item,
    );

    setNotice(response.created_new_vote ? "Upvote recorded." : "You already voted for this ticket.");
  } catch (error) {
    console.error(error);
    setNotice(error instanceof Error ? error.message : "Unable to upvote that ticket.", "error");
  } finally {
    setTicketBusy(ticket.id, false);
  }
}

function ownerLabel(ticket: TicketSummary) {
  return ticket.owner_display_name || ticket.owner_email;
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}


onMounted(async () => {
  await Promise.all([loadViewer(), loadTickets()]);
});
</script>

<style scoped>
.community-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  color: #0f172a;
}

.community-hero,
.community-card,
.community-board {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 1.5rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
  box-shadow:
    0 24px 48px rgba(15, 23, 42, 0.08),
    0 10px 22px rgba(148, 163, 184, 0.12);
}

.community-hero {
  position: relative;
  overflow: hidden;
  padding: 1.5rem;
  background:
    radial-gradient(circle at top right, rgba(15, 118, 110, 0.16), transparent 32%),
    radial-gradient(circle at bottom left, rgba(249, 115, 22, 0.14), transparent 26%),
    linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
}

.community-hero__eyebrow,
.community-card__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #0f766e;
}

.community-hero__content {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.community-hero__title {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1.02;
  letter-spacing: -0.04em;
}

.community-hero__description,
.community-card__copy,
.community-board__description,
.feature-card__description,
.community-stat-card__copy,
.community-form__hint,
.community-auth-prompt__copy {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}

.community-hero__description {
  max-width: 44rem;
  margin-top: 0.9rem;
  font-size: 1rem;
}

.community-hero__stats {
  display: grid;
  gap: 1rem;
}

.community-stat-card {
  padding: 1rem 1.1rem;
  border-radius: 1.15rem;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(226, 232, 240, 0.88);
}

.community-stat-card__label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.community-stat-card__value {
  display: block;
  margin-top: 0.5rem;
  font-size: 1.25rem;
  line-height: 1.2;
}

.community-stat-card__copy {
  margin-top: 0.45rem;
  font-size: 0.92rem;
}

.community-stat-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.9rem;
  text-decoration: none;
}

.community-grid {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
}

.community-card,
.community-board {
  padding: 1.4rem;
}

.community-card--submit {
  width: min(100%, 860px);
}

.community-card__header,
.community-board__header,
.feature-card,
.community-channel,
.community-form__footer,
.feature-card__footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.community-card__title-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.community-card__header--center {
  justify-content: center;
  text-align: center;
}

.community-card__logo {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 1.15rem;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(241, 245, 249, 0.92));
  border: 1px solid rgba(226, 232, 240, 0.88);
}

.community-card__logo img {
  width: 1.75rem;
  height: 1.75rem;
}

.community-card__title,
.community-board__title,
.feature-card__title {
  margin: 0;
  font-weight: 700;
  color: #0f172a;
}

.community-card__title,
.community-board__title {
  font-size: 1.35rem;
}

.community-card__badge,
.feature-card__tag,
.feature-card__chip {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.1);
  color: #0f766e;
  font-size: 0.78rem;
  font-weight: 700;
}

.community-channel {
  margin: 1.25rem 0;
  padding: 1rem 1.1rem;
  border-radius: 1.1rem;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.92));
  color: #f8fafc;
}

.community-channel__label {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.72);
}

.community-channel__name {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.community-pill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 1.2rem;
}

.community-pill {
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.08);
  color: #155e75;
  font-size: 0.88rem;
  font-weight: 600;
}

.community-notice {
  margin-top: 1rem;
  border-radius: 1rem;
  padding: 0.85rem 1rem;
  font-weight: 600;
}

.community-notice--success {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.community-notice--error {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.community-form__meta,
.community-auth-prompt {
  margin-top: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(248, 250, 252, 0.92);
}

.community-form__meta {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.community-form__meta-label {
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.community-auth-prompt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.community-auth-prompt__button {
  white-space: nowrap;
}

.community-auth-prompt__google-logo {
  width: 20px;
  height: 20px;
  margin-right: 10px;
}

.community-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.25rem;
}

.community-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  font-weight: 600;
  color: #0f172a;
}

.community-form__field span {
  font-size: 0.92rem;
}

.community-form__field input,
.community-form__field textarea {
  width: 100%;
  border: 1px solid rgba(203, 213, 225, 0.95);
  border-radius: 1rem;
  padding: 0.9rem 1rem;
  background: #ffffff;
  color: #0f172a;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.community-form__field input:focus,
.community-form__field textarea:focus {
  outline: none;
  border-color: rgba(15, 118, 110, 0.55);
  box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.12);
  transform: translateY(-1px);
}

.community-form__field input:disabled,
.community-form__field textarea:disabled {
  background: #f8fafc;
  cursor: not-allowed;
}

.community-form__actions,
.feature-card__actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.community-button {
  border: none;
  border-radius: 999px;
  padding: 0.78rem 1.15rem;
  font-weight: 700;
  color: #0c0505;
  background: linear-gradient(135deg, #d8e2eb, #caf0f8);
  box-shadow: 0 16px 30px #caf0f8;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease,
    filter 0.18s ease;
}

.community-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 20px 36px rgba(15, 118, 110, 0.24);
}

.community-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.community-button--secondary {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: none;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.community-button--secondary:hover:not(:disabled) {
  box-shadow: none;
}

.community-button--ghost {
  color: #0f172a;
  background: rgba(15, 23, 42, 0.06);
  box-shadow: none;
}

.community-board__header {
  margin-bottom: 1.2rem;
}

.community-board__description {
  max-width: 24rem;
}

.community-board__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.community-empty-state {
  padding: 2rem 1rem;
  text-align: center;
  color: #64748b;
  border: 1px dashed rgba(203, 213, 225, 0.95);
  border-radius: 1.2rem;
  background: rgba(248, 250, 252, 0.9);
}

.feature-card {
  padding: 1.15rem;
  border-radius: 1.2rem;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background:
    radial-gradient(circle at top right, rgba(14, 165, 164, 0.08), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
}

.feature-card__votes {
  flex: 0 0 8rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.95rem 0.9rem;
  border-radius: 1rem;
  background: rgba(248, 250, 252, 0.96);
  border: 1px solid rgba(226, 232, 240, 0.92);
}

.feature-card__vote-count {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  color: #0f172a;
}

.feature-card__vote-label {
  margin-top: 0.2rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.feature-card__vote-button {
  width: 100%;
  margin-top: 0.95rem;
  padding-inline: 0.9rem;
}

.feature-card__vote-button--voted {
  filter: blur(0.7px);
  opacity: 0.72;
}

.feature-card__vote-button--login {
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
}

.feature-card__content {
  flex: 1 1 auto;
}

.feature-card__header,
.feature-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.feature-card__meta {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-bottom: 0.4rem;
}

.feature-card__author,
.feature-card__timestamp {
  font-size: 0.88rem;
  color: #64748b;
}

.feature-card__title {
  font-size: 1.15rem;
}

.feature-card__description {
  margin-top: 0.6rem;
  max-width: 48rem;
}

.feature-card__footer {
  margin-top: 1rem;
}

.feature-card__action {
  border: 1px solid rgba(203, 213, 225, 0.95);
  border-radius: 999px;
  padding: 0.5rem 0.85rem;
  background: #ffffff;
  color: #0f172a;
  font-weight: 700;
}

.feature-card__action--danger {
  color: #b91c1c;
}

@media (max-width: 1199.98px) {
  .community-hero__content {
    grid-template-columns: 1fr;
  }

  .community-board__header,
  .community-card__header,
  .community-channel,
  .community-form__footer,
  .community-auth-prompt,
  .feature-card__footer {
    flex-direction: column;
  }
}

@media (max-width: 767.98px) {
  .community-page {
    padding: 1rem;
  }

  .feature-card {
    flex-direction: column;
  }

  .feature-card__votes {
    flex: 1 1 auto;
    width: 100%;
  }

  .community-hero__title {
    font-size: 2rem;
  }

  .community-channel__name {
    font-size: 1.35rem;
  }

  .community-form__actions,
  .feature-card__actions {
    width: 100%;
    justify-content: stretch;
  }

  .community-form__actions > *,
  .feature-card__actions > * {
    flex: 1 1 auto;
  }
}
</style>
