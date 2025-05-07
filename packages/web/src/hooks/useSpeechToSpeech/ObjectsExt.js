// This file is copied from https://github.com/aws-samples/amazon-nova-samples/blob/main/speech-to-speech/sample-codes/websocket-nodejs/public/src/lib/util/ObjectsExt.js
export class ObjectExt {
  static exists(obj) {
    return obj !== undefined && obj !== null;
  }

  static checkArgument(condition, message) {
    if (!condition) {
      throw TypeError(message);
    }
  }

  static checkExists(obj, message) {
    if (ObjectsExt.exists(obj)) {
      throw TypeError(message);
    }
  }
}
