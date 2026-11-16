export class JSONHandler {
  constructor(json) {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new TypeError("Expected a JSON object.");
    }

    this.json = json;
  }

  getJSON() {
    return this.json;
  }

  getField(fieldName) {
    const value = this.json[fieldName];
    return value == null ? null : String(value);
  }
}
