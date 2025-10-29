// import "reflect-metadata";
// import { KEY_PARAMS_ROUTE, KEY_TYPE_CONTROLLER } from "../constants";
// import { DecoratorHelper, getDecorData } from "../decorator-base";
// import { RouterList } from "../types";

// /**
//  * Helper function to create route decorators for HTTP methods.
//  *
//  * @param {string} method - The HTTP method (e.g., GET, POST).
//  * @returns {(path?: string) => MethodDecorator} - A method decorator for defining routes.
//  *
//  */
// export default function createRouteDecorator<T extends any = undefined>(
//   method: string
// ) {
//   return (path: string = "/", options?: T): MethodDecorator & ClassDecorator =>
//     DecoratorHelper<RouterList>({
//       type: KEY_TYPE_CONTROLLER,
//       key: KEY_PARAMS_ROUTE,
//       targetResolver: (target) => target.constructor ?? target,
//       options: (saved, Target, propertyKey, descriptor) => {
//         // add openAPI data here

//         let store = saved || { routes: new Set() };
//         const handler = Target.prototype[propertyKey];

//         if (typeof handler !== "function") return store;

//         if (!store.routes) store.routes = new Set();

//         store.routes.add({
//           className: Target.name,
//           method,
//           path,
//           propertyKey,
//           handler: handler,
//           options,
//         });

//         return store;
//       },
//     });
// }
