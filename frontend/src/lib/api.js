const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = async (path, options = {}) => {
	let response;
	try {
		response = await fetch(`${BASE}${path}`, options);
	} catch {
		throw new Error("Cannot reach the API. Check that the backend is running on port 8000.");
	}

	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(body.detail || `Request failed (${response.status}).`);
	}
	return body;
};
