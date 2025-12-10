import z from "zod";

// Vault Actions
export const CreateSchema = z.literal("Create");
export type CREATE = z.infer<typeof CreateSchema>;
export const CREATE = CreateSchema.value;

export const MoveSchema = z.literal("Move");
export type MOVE = z.infer<typeof MoveSchema>;
export const MOVE = MoveSchema.value;

export const DeleteSchema = z.literal("Delete");
export type DELETE = z.infer<typeof DeleteSchema>;
export const DELETE = DeleteSchema.value;

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
