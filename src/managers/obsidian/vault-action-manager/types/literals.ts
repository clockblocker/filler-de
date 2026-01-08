import z from "zod";

// Vault Actions
export const CreateSchema = z.literal("Create");
export type CREATE = z.infer<typeof CreateSchema>;
export const CREATE = CreateSchema.value;

export const RenameSchema = z.literal("Rename");
export type RENAME = z.infer<typeof RenameSchema>;
export const RENAME = RenameSchema.value;

export const DeleteSchema = z.literal("Delete");
export type DELETE = z.infer<typeof DeleteSchema>;
export const DELETE = DeleteSchema.value;

export const TrashSchema = z.literal("Trash");
export type TRASH = z.infer<typeof TrashSchema>;
export const TRASH = TrashSchema.value;

export const UpsertSchema = z.literal("Upsert");
export type UPSERT = z.infer<typeof UpsertSchema>;
export const UPSERT = UpsertSchema.value;

export const ProcessSchema = z.literal("Process");
export type PROCESS = z.infer<typeof ProcessSchema>;
export const PROCESS = ProcessSchema.value;

export const FileSchema = z.literal("File");
export type FILE = z.infer<typeof FileSchema>;
export const FILE = FileSchema.value;

export const MdFileSchema = z.literal("MdFile");
export type MD_FILE = z.infer<typeof MdFileSchema>;
export const MD_FILE = MdFileSchema.value;

export const FolderSchema = z.literal("Folder");
export type FOLDER = z.infer<typeof FolderSchema>;
export const FOLDER = FolderSchema.value;

export const MdSchema = z.literal("md");
export type MD = z.infer<typeof MdSchema>;
export const MD = MdSchema.value;

export const EmptyStringSchema = z.literal("");
export type EMPTY_STRING = z.infer<typeof EmptyStringSchema>;
export const EMPTY_STRING = EmptyStringSchema.value;
