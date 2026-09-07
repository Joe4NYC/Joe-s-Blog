import type { Env } from '../lib/env';
import { dispatchWorkflow, listRunsForWorkflow, listWorkflowRuns, repoRef, type WorkflowRun } from '../lib/github';
import { ok } from '../lib/http';

function workflowFile(env: Env): string {
	return env.DEPLOY_WORKFLOW?.trim() || 'deploy.yml';
}

/**
 * The newest run of the deploy workflow specifically — CI runs on every push
 * too, so the newest run overall is often not a deployment.
 */
export async function latestDeployRun(env: Env): Promise<WorkflowRun | null> {
	const runs = await listRunsForWorkflow(repoRef(env), workflowFile(env), 1);
	return runs[0] ?? null;
}

export async function handleDeployStatus(env: Env): Promise<Response> {
	const runs = await listWorkflowRuns(repoRef(env), 5);

	return ok({
		runs: runs.map((run) => ({
			id: run.id,
			name: run.name,
			status: run.status,
			conclusion: run.conclusion,
			url: run.html_url,
			event: run.event,
			createdAt: run.created_at,
			updatedAt: run.updated_at,
		})),
	});
}

export async function handleDeploy(env: Env): Promise<Response> {
	await dispatchWorkflow(repoRef(env), workflowFile(env));
	return ok({ workflow: workflowFile(env), message: '已送出部署要求，通常 1–3 分鐘後生效。' });
}
