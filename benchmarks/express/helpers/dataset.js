export class Dataset {
  constructor(entityName = 'users', count = 100, generator = null) {
    this.entityName = entityName;
    this.items = Array.from({ length: count }, (_, i) =>
      generator ? generator(i) : { id: i + 1 }
    );
  }

  findById(id) {
    return this.items.find((item) => item.id === Number(id));
  }

  getAll() {
    return this.items;
  }

  create(data) {
    const newItem = { id: this.items.length + 1, ...data };
    this.items.push(newItem);
    return newItem;
  }

  update(id, data) {
    const item = this.findById(id);
    if (!item) return null;
    Object.assign(item, data);
    return item;
  }

  delete(id) {
    const index = this.items.findIndex((item) => item.id === Number(id));
    if (index === -1) return null;
    const [deleted] = this.items.splice(index, 1);
    return deleted;
  }
}
