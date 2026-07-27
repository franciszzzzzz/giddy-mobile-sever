const conversations = new Map();

function get(sessionId) {
  return conversations.get(sessionId) || null;
}

function set(sessionId, memory) {
  conversations.set(sessionId, memory);
}

function remove(sessionId) {
  conversations.delete(sessionId);
}

export default {
  get,
  set,
  remove,
};
