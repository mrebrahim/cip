export type UserRole = "admin" | "teacher";

export type LectureStatus =
  | "pending"
  | "transcribing"
  | "reading_slides"
  | "building"
  | "ready"
  | "failed"
  | "stopped";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  created_at: string;
};

export type Diploma = {
  id: string;
  name: string;
  created_at: string;
};

export type Subject = {
  id: string;
  diploma_id: string;
  name: string;
  created_at: string;
};

export type Lecture = {
  id: string;
  subject_id: string;
  created_by: string;
  title: string;
  audio_url: string;
  audio_file_id: string;
  audio_file_name: string | null;
  slides_url: string;
  slides_file_id: string;
  slides_file_name: string | null;
  status: LectureStatus;
  transcript: string | null;
  slides_text: string | null;
  document_md: string | null;
  error_message: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
  stage_updated_at: string;
};
