declare namespace WechatMiniprogram {
  type IAnyObject = Record<string, any>;
}
declare const wx: any;
declare function getApp<T = any>(): T;
declare function Page(opts: any): void;
declare function Component(opts: any): void;
declare function App(opts: any): void;
declare function getCurrentPages(): any[];
