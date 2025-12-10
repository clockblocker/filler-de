import z from "zod";

// Vault Actions
export const CreateSchema = z.literal("Create");
export type CREATE = z.infer<typeof CreateSchema>;
export const CREATE = CreateSchema.value;

export const RenameSchema = z.literal("Rename");
export type RENAME = z.infer<typeof RenameSchema>;
export const RENAME = RenameSchema.value;

export const TrashSchema = z.literal("Trash");
export type TRASH = z.infer<typeof TrashSchema>;
export const TRASH = TrashSchema.value;

export const ProcessSchema = z.literal("Process");
export type PROCESS = z.infer<typeof ProcessSchema>;
export const PROCESS = ProcessSchema.value;

export const WriteSchema = z.literal("Write");
export type WRITE = z.infer<typeof WriteSchema>;
export const WRITE = WriteSchema.value;

export const FileSchema = z.literal("File");
export type FILE = z.infer<typeof FileSchema>;
export const FILE = FileSchema.value;

export const MdFileSchema = z.literal("MdFile");
export type MD_FILE = z.infer<typeof MdFileSchema>;
export const MD_FILE = MdFileSchema.value;

export const FolderSchema = z.literal("Folder");
export type FOLDER = z.infer<typeof FolderSchema>;
export const FOLDER = FolderSchema.value;
