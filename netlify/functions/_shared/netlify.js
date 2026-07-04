const NETLIFY_API_BASE = "https://api.netlify.com/api/v1";

function getOptionalEnv(name) {
    const value = Netlify.env.get(name);
    return value ? value.trim() : "";
}

function getField(source, fieldName) {
    const value = source?.[fieldName];
    if (typeof value === "string") {
        return value.trim();
    }
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).find(Boolean) ?? "";
    }
    return "";
}

export async function listNetlifySampleRequests({ siteId, formName }) {
    const token = getOptionalEnv("NETLIFY_API_TOKEN");
    if (!token || !siteId) {
        return [];
    }

    const formsResponse = await fetch(`${NETLIFY_API_BASE}/sites/${siteId}/forms`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!formsResponse.ok) {
        throw new Error(`Netlify forms lookup failed (${formsResponse.status})`);
    }

    const forms = await formsResponse.json();
    const form = forms.find((item) => item.name === formName);
    if (!form) {
        return [];
    }

    const submissionsResponse = await fetch(
        `${NETLIFY_API_BASE}/forms/${form.id}/submissions?per_page=100`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );

    if (!submissionsResponse.ok) {
        throw new Error(`Netlify submissions lookup failed (${submissionsResponse.status})`);
    }

    const submissionsPayload = await submissionsResponse.json();
    const submissions = Array.isArray(submissionsPayload)
        ? submissionsPayload
        : submissionsPayload.submissions ?? submissionsPayload.items ?? [];

    return submissions.map((submission) => {
        const data = submission.data ?? submission.fields ?? submission;

        return {
            source: "netlify",
            id: submission.id,
            threadId: "",
            messageId: "",
            receivedAt: submission.created_at ?? submission.createdAt ?? "",
            requesterEmail: getField(data, "email") || getField(submission, "email"),
            requesterName: getField(data, "name") || getField(submission, "name"),
            note: getField(data, "message") || getField(data, "note"),
        };
    });
}
