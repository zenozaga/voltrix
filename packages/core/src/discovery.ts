import { Constructor } from './di.js';

export interface DiscoveryNode {
  target: Constructor;
  fullPath: string;
  meta: any;
}

export interface RouteNode extends DiscoveryNode {
  method: string;
  propertyKey: string | symbol;
}

export interface ControllerNode extends DiscoveryNode {
  routes: RouteNode[];
}

export interface ModuleNode extends DiscoveryNode {
  controllers: ControllerNode[];
  subModules: ModuleNode[];
}

export interface AppTree {
  name: string;
  modules: ModuleNode[];
}
