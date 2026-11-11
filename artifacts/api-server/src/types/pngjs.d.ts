declare module "pngjs" {
  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    constructor(options: { width: number; height: number });
    bitblt(target: PNG, sourceX: number, sourceY: number, width: number, height: number, targetX: number, targetY: number): void;
    static sync: {
      read: (buffer: Buffer) => PNG;
      write: (png: PNG) => Buffer;
    };
  }
}
