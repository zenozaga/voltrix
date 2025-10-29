import { Request } from '@voltrix/express';

const kRoles = Symbol('roles');
const kScopes = Symbol('scopes');

declare module '@voltrix/express' {
  interface Request {
    setRole(role: string): this;
    hasRole(role: string): boolean;
    getRoles(): string[];

    setScopes(scopes: string[]): this;
    hasScopes(scopes: string[]): boolean;
    getScopes(): string[];

    setRoleScopes(role: string, scopes: string[]): this;
  }
}

function getOrCreateState(req: Request) {
  if (!(req as any)[kRoles]) (req as any)[kRoles] = new Set<string>();
  if (!(req as any)[kScopes]) (req as any)[kScopes] = new Set<string>();
  return {
    roles: (req as any)[kRoles] as Set<string>,
    scopes: (req as any)[kScopes] as Set<string>,
  };
}

///////////////////////////
/// Extensions
///////////////////////////

const proto = Request.prototype;

proto.setRole = function (role: string) {
  const { roles } = getOrCreateState(this);
  roles.add(role);
  return this;
};

proto.hasRole = function (role: string) {
  const { roles } = getOrCreateState(this);
  return roles.has(role);
};

proto.getRoles = function () {
  const { roles } = getOrCreateState(this);
  return Array.from(roles);
};

proto.setScopes = function (scopes: string[]) {
  const { scopes: s } = getOrCreateState(this);
  s.clear();
  scopes.forEach(scope => s.add(scope));
  return this;
};

proto.hasScopes = function (scopes: string[]) {
  const { scopes: s } = getOrCreateState(this);
  return scopes.every(scope => s.has(scope));
};

proto.getScopes = function () {
  const { scopes } = getOrCreateState(this);
  return Array.from(scopes);
};

proto.setRoleScopes = function (role: string, scopes: string[]) {
  const state = getOrCreateState(this);
  state.roles.add(role);
  state.scopes.clear();
  scopes.forEach(scope => state.scopes.add(scope));
  return this;
};
