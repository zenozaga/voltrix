// import path from "node:path";
// import { Transform } from "node:stream";
// import type { Request } from "../types/hyper-express-types";

// import { createCustomRequestDecorator } from "./Http";
// import HyperFileException from "../exceptions/HyperFileException";

// import {
//   FileOptions,
//   FileRestrictions,
//   UploadedFileStream,
//   resolveRestrictions,
// } from "./types";

// // main export
// export const FileStream = (options: FileOptions | string) => {
//   const _options: FileOptions =
//     typeof options === "string" ? { fieldName: options } : options;

//   return createCustomRequestDecorator("FileStream", async (request: Request) => {
//     const { allowedMimeTypes, maxFileSize } = await resolveRestrictions(
//       request,
//       _options.restrictions
//     );

//     const allowAll =
//       allowedMimeTypes.includes("*") || allowedMimeTypes.length === 0;

//     const contentType = request.headers?.["content-type"] ?? "";
//     if (!contentType.includes("multipart/form-data")) {
//       throw new HyperFileException(
//         "Unsupported Media Type: expected multipart/form-data",
//         { fieldName: _options.fieldName, contentType },
//         415
//       );
//     }

//     const files = await extractFilesStream(request, {
//       maxSize: Number.isFinite(maxFileSize) ? maxFileSize : undefined,
//       mimeTypes: allowAll ? undefined : allowedMimeTypes,
//       requires: _options.required
//         ? Array.isArray(_options.fieldName)
//           ? _options.fieldName
//           : [_options.fieldName]
//         : undefined,
//       requireName: true,
//     });

//     return Array.isArray(_options.fieldName) ? files : files[_options.fieldName];
//   });
// };

// // sugar
// FileStream.options = (opts: FileOptions, required = false) =>
//   (fieldName: string | string[]) =>
//     FileStream({ ...opts, required, fieldName });

// FileStream.restrictions = (restrictions: FileRestrictions) =>
//   (fieldName: string | string[], required = false) =>
//     FileStream({ fieldName, restrictions, required });

// // ------------------------- helpers -------------------------

// type ExtractOptions<T extends string = string> = {
//   maxSize?: number;
//   mimeTypes?: string[];
//   requires?: T[];
//   requireName?: boolean;
// };

// let _fileTypeFromBuffer:
//   | ((b: Buffer) => Promise<{ ext: string; mime: string } | undefined>)
//   | undefined;

// async function fileTypeFromBufferOnce(buf: Buffer) {
//   if (!_fileTypeFromBuffer) {
//     const mod = await import("file-type");
//     _fileTypeFromBuffer = mod.fileTypeFromBuffer;
//   }
//   return _fileTypeFromBuffer(buf);
// }


// function createPeekTypeTransform(opts: {
//   maxSize?: number;
//   allowed?: string[];
//   onType: (mime: string, ext: string) => void;
// }) {
//   const KEEP = 4100;
//   const cap = opts.maxSize ?? 0;
//   const allow = opts.allowed;

//   let total = 0;
//   let peekLen = 0;
//   const peekChunks: Buffer[] = [];
//   let typed = false;

//   const t = new Transform({
//     transform(chunk, _enc, cb) {
//       const buf = chunk as Buffer;
//       total += buf.length;

//       if (cap && total > cap) {
//         return cb(
//           new HyperFileException(
//             "Payload too large",
//             { size: total, maxSize: cap },
//             413
//           )
//         );
//       }

//       if (!typed && peekLen < KEEP) {
//         const need = KEEP - peekLen;
//         peekChunks.push(need >= buf.length ? buf : buf.subarray(0, need));
//         peekLen += Math.min(need, buf.length);

//         if (peekLen >= KEEP) {
//           (async () => {
//             const ft = await fileTypeFromBufferOnce(Buffer.concat(peekChunks));
//             if (!ft) return t.destroy(new HyperFileException("Invalid file type", {}, 415));
//             if (allow && !allow.includes(ft.mime)) {
//               return t.destroy(
//                 new HyperFileException(
//                   "Invalid file type (not allowed)",
//                   { mimeType: ft.mime, allowedMimeTypes: allow },
//                   415
//                 )
//               );
//             }
//             typed = true;
//             opts.onType(ft.mime, ft.ext);
//           })().catch((err) => t.destroy(err));
//         }
//       }

//       cb(null, buf);
//     },
//   });

//   (t as any).__getTotal = () => total;
//   return t;
// }

// async function extractFilesStream<T extends string = string>(
//   request: Request,
//   options: ExtractOptions<T> = {}
// ): Promise<Record<T, UploadedFileStream>> {
//   const filesMap = {} as Record<T, UploadedFileStream>;

//   await request.multipart(async (field) => {
//     const file = field.file;
//     if (!file?.stream) return;


//     if (options.requireName && !file.name) {
//       throw new HyperFileException("File name is required", { field: field.name }, 400);
//     }

//     let detectedMime = "";
//     let detectedExt = "";

//     const inspector = createPeekTypeTransform({
//       maxSize: options.maxSize,
//       allowed: options.mimeTypes,
//       onType: (mime, ext) => {
//         detectedMime = mime;
//         detectedExt = ext;
//       },
//     });

//     const src = file.stream as NodeJS.ReadableStream;
//     src.pipe(inspector);

//     await new Promise((r) => setImmediate(r));

//     const parsed = path.parse(file.name ?? field.name);
//     const base = parsed.name || field.name;
//     const fallbackExt = parsed.ext.replace(/^\./, "") || "bin";
//     const ext = detectedExt || fallbackExt;
//     const mime = detectedMime || "application/octet-stream";
//     const filename = `${base}.${ext}`;

//     const record: UploadedFileStream = {
//       name: base,
//       filename,
//       ext,
//       mimeType: mime,
//       stream: inspector,
//     };

//     inspector.once("end", () => {
//       const total = (inspector as any).__getTotal?.();
//       if (typeof total === "number") record.size = total;
//     });

//     const onError = () => {};
//     src.once("error", onError);
//     inspector.once("error", onError);

//     filesMap[field.name as T] = record;
//   });

//   if (options.requires) {
//     for (const required of options.requires) {
//       if (!filesMap[required]) {
//         throw new HyperFileException(`File "${required}" is required`, { required }, 400);
//       }
//     }
//   }

//   return filesMap;
// }
