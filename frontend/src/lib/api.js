const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = async (path, options = {}) => {
	const token = localStorage.getItem("insightops_token");
	const headers = { ...(options.headers || {}) };

	if (token && !headers["Authorization"] && !headers["authorization"]) {
		headers["Authorization"] = `Bearer ${token}`;
	}

	if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
		headers["Content-Type"] = "application/json";
	}

	let response;
	try {
		response = await fetch(`${BASE}${path}`, { ...options, headers });
	} catch {
		throw new Error("Cannot reach the API. Check that the backend is running on port 8000.");
	}

	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		const detail = body.detail || (body.message ? body.message : `Request failed (${response.status}).`);
		throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
	}
	return body;
};
