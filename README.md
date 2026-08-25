# محاضراتي — Lecture to Document

Turns a recorded lecture (audio on Google Drive) plus its slide deck (PDF on
Google Drive) into a structured Arabic document: executive summary, explained
body, key takeaways, and a question bank with an answer key.

The interface is entirely Arabic and RTL. This file is in English for
documentation only.

---

## How it works

```
Diploma
 └── Subject  ── assigned to one or more teachers
      └── Lecture
           ├── audio link (Drive)
           ├── slides PDF link (Drive)
           └── generated document
```

A teacher signs in, opens one of their subjects, and adds a lecture with three
fields: title, audio link, slides link. Both links are checked while they are
still on the form. Processing then runs in four stages:

| # | Stage | Stored as |
|---|-------|-----------|
| 1 | Transcribe the recording | `transcript` |
| 2 | Read the slide deck | `slides_text` |
| 3 | Merge into a document | `document_md` |
| 4 | Ready | — |

**Every stage is persisted the moment it completes.** A failure while building
the document does not throw away the transcription; a retry resumes from the
last completed stage.

Supabase stores text only. The audio and the PDF stay on Drive and are held in
memory just long enough to hand them to Gemini.

### Why there is no stored Word file

The Word file is a second representation of text that already exists. Storing
it means keeping two copies of one thing, and the stored copy goes stale the
moment a document is regenerated. It is rendered from `document_md` on request
instead — that takes milliseconds, and the database stays the single source of
truth.

---

## Isolation

A teacher sees only the subjects they are assigned to. That is enforced by
Postgres row level security, not by frontend code: even a direct API call with
another subject's ID returns nothing.

The policies were verified against a signed-in teacher session. All of the
following are blocked at the database:

- reading another teacher's subject, lecture, or profile
- inserting a lecture into a subject they do not hold
- creating a lecture while forging `created_by`
- assigning themselves to a subject
- promoting themselves to admin
- updating another teacher's lecture

Column grants narrow it further: a teacher may rename their own lecture, but
cannot write `transcript`, `slides_text`, `document_md`, or `status` — those
belong to the pipeline.

---

## Setup

### 1. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | same page — server only, never exposed |
| `GEMINI_API_KEY` | Google AI Studio / Cloud — Gemini only |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Cloud service account — Drive only, see below |
| `CRON_SECRET` | any long random string you choose |

### 2. Google access — this changed from the original plan

The plan was one key serving both Gemini and Drive. **That is not possible.**

Gemini works with an API key. Drive does not: the Drive API rejects API keys
outright —

> API keys are not supported by this API. Expected OAuth2 access token or other
> authentication credentials that assert a principal.

— and it does so **even for a file shared with "Anyone with the link"**. This
was verified against a real public file, so it is not a key misconfiguration
and enabling the Drive API does not fix it. Drive requires a principal; an API
key is not one.

So there are two credentials:

| Variable | Used for |
|---|---|
| `GEMINI_API_KEY` | Gemini only — transcription, slide reading, document build |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Drive only — reading the audio and the PDF |

**Nothing changes for teachers.** A service account is a principal, so it can
read anyone-with-the-link files exactly like a signed-in user. Teachers still
just open sharing and paste the link.

#### Creating the service account

1. Google Cloud Console → IAM & Admin → Service Accounts → **Create**.
2. Give it any name. No project roles are needed — it only reads public files.
3. Open it → **Keys** → Add key → Create new key → **JSON**.
4. Paste the downloaded JSON into `GOOGLE_SERVICE_ACCOUNT_JSON`, raw or
   base64-encoded (base64 is easier to paste into the Vercel dashboard as one
   line).
5. Enable the **Google Drive API** on that project.

If you would rather not rely on public links at all, share the lecture folder
directly with the service account's email address (`...@....iam.gserviceaccount.com`).
That works too, and is stricter — files need not be public at all.

### 3. Drive sharing

Files must be either shared as **"Anyone with the link"** or shared directly
with the service account's email address.

When neither is true, Drive returns a 404 rather than admitting the file
exists, so the app reports it as closed sharing — which is the usual cause —
and says exactly what to change, in Arabic, on the form, before the lecture is
recorded.

### 4. Database

The schema lives in `supabase/migrations/` and is already applied to the
project. To apply it elsewhere, run the files in order.

The four 2026 diplomas are seeded. Subjects, teachers, and assignments are
created from the admin panel at `/admin`.

### 5. The first admin

There is no self-signup, so the first admin is made by hand — once:

1. Supabase dashboard → Authentication → Add user (with a password, confirmed).
2. Then run:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

Every account after that is created from `/admin`.

### 6. Vercel

Two settings are not optional:

- **Fluid Compute must be enabled.** Processing a long lecture runs well past
  60 seconds; the routes declare `maxDuration = 800`, and without Fluid Compute
  the request is cut off mid-transcription.
- **Cron requires the Pro plan.** `vercel.json` schedules `/api/cron/retry`
  every 5 minutes. The Hobby plan caps cron at once per day, which is far too
  slow to be a safety net.

The cron job resumes anything that has sat in the same stage for over 15
minutes — a teacher closing the browser, or a dropped request. It is what makes
the waiting screen's promise ("you can close this page") true.

---

## Running locally

```bash
npm install
npm run dev
```

`npm run typecheck` type-checks without building.

---

## Routes

```
POST /api/lectures                  Register a lecture (validates both links first)
POST /api/lectures/[id]/process     Run the pipeline
GET  /api/lectures/[id]/export      Download as Word
POST /api/validate-link             Live link check behind the form
GET  /api/cron/retry                Safety net for stalled lectures
```

---

## Deliberately not built

- Mind maps — removed permanently.
- Uploading files from the device — Drive is the only source.
- Editing documents in the app — read and export only.
- Student accounts.
- Any model other than Gemini.
- Self-signup.
- Cost tracking (Phase 4).

## Open questions, and what the code currently does

| # | Question | Current behaviour |
|---|---|---|
| 1 | Can a teacher delete their own lecture? | Yes — their own only; admins can delete any. Change the `lectures_delete` policy to make it admin-only. |
| 2 | When a teacher is removed from a subject, do their documents stay or move? | They stay with the subject. Removing an assignment only removes the assignment. |
| 3 | Should documents be written back to Drive? | No, manual download only. Note this is now cheap to add if wanted: the service account already exists, and only its scope would need widening from `drive.readonly`. |

The Drive hint on the new-lecture form uses a drawn stand-in for the share
dialog. Swapping in a real screenshot means replacing one `<svg>` in
`components/DriveHint.tsx`.
