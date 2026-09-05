declare module "write-file-atomic" {
  interface WriteFileAtomicOptions {
    chown?: { uid: number; gid: number } | false;
    encoding?: BufferEncoding;
    fsync?: boolean;
    mode?: number;
    tmpfileCreated?: (path: string) => void | Promise<void>;
  }

  export default function writeFileAtomic(
    filename: string,
    data: string | NodeJS.ArrayBufferView,
    options?: WriteFileAtomicOptions | BufferEncoding,
  ): Promise<void>;
}
