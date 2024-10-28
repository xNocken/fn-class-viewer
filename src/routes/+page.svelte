<script lang="ts">
	import type { Root, Struct } from '$lib/server/get-classes';
	import { onMount } from 'svelte';
	import PropertyList from '$lib/app/property-list.svelte';
	import { getFuncChecksum } from '$lib/common/checksum-generator';
	import { functionReplicates } from '$lib/common/function-flags';
	import { EClassFlags, EStructFlags } from '../types/properties';

	const pageLimits = [10, 25, 50, 100, 200, 250, 500, 1000];

	let limitPerPage = 50;
	let page = 0;
	let filters: string[] = [];
	let classes: Root | null = null;
	let totalClasses = 0;
	let totalPages = 0;

	let currentInput = '';
	let replicatedOnly: boolean = false;
	let fetchedStructs: Record<string, Struct> = {};

	const classExtendedStates: Record<string, boolean> = {};
	const classTabStates: Record<string, 'properties' | 'functions'> = {};

	const updateClasses = async () => {
		const res = await fetch(`/api/get-filtered-classes`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				filters,
				limitPerPage,
				page,
			}),
		});

		const json = await res.json();

		classes = json.classes;
		totalClasses = json.total;
		totalPages = json.totalPages;

		page = Math.max(0, Math.min(totalPages - 1, page));
	};

	const handleFilterAdd = () => {
		if (!currentInput?.length) {
			return;
		}

		filters.push(currentInput);
		currentInput = '';
		page = 0;

		filters = filters;

		updateClasses();
	};

	onMount(updateClasses);
</script>

<div class="filter">
	{#each filters as filter, index}
		<div class="filter__entry">
			<div class="filter__entry-text">{filter}</div>
			<button
				class="filter__entry-button"
				on:click={() => {
					filters.splice(index, 1);
					filters = filters;
					updateClasses();
				}}>X</button
			>
		</div>
	{/each}

	<div class="filter__add">
		<input
			class="filter__add-text"
			type="text"
			id="search"
			bind:value={currentInput}
			on:keydown={(e) => {
				if (e.key === 'Enter') {
					handleFilterAdd();
				}
			}}
		/>

		<button class="filter__add-button" on:click={handleFilterAdd}>Add</button>
	</div>

	<div class="filter__entry">
		<div class="filter__entry-text">Replicated Only</div>

		<input type="checkbox" bind:checked={replicatedOnly} />
	</div>
</div>

<div class="pagination">
	<button
		disabled={page === 0}
		on:click={() => {
			page = Math.max(0, Math.min(totalPages - 1, page - 1));
			updateClasses();
		}}>&lt;</button
	>

	<button
		disabled={page === totalPages - 1}
		on:click={() => {
			page = Math.max(0, Math.min(totalPages - 1, page + 1));
			updateClasses();
		}}>&gt;</button
	>

	<div class="pagination__stats">
		{page + 1} / {totalPages} ({totalClasses} classes)
	</div>

	<div>
		<select class="pagination__limit-select" bind:value={limitPerPage} on:change={updateClasses}>
			{#each pageLimits as limit}
				<option value={limit} selected={limit === limitPerPage}>{limit}</option>
			{/each}
		</select>

		<span>/page</span>
	</div>
</div>

<div class="classes">
	{#if classes}
		{#each classes.Classes as item}
			<div class="classes__entry">
				<button
					class="button-no-style classes__entry-button"
					on:click={() => {
						classExtendedStates[item.FullName] = !classExtendedStates[item.FullName];
					}}
				>
					<div class="classes__entry-name">
						{item.Name}
					</div>
					<div class="classes__entry-name">
						<span style="display: block">Package</span>
						{item.FullName.split('.')[0]}
					</div>
				</button>

				{#if classExtendedStates[item.FullName]}
				
				<div class="classes__entry-content">
						<div class="classes__entry-content-title">
							<span style="display: block">Extends</span>
							{item.Parent}
						</div>
						
						<div class="classes__entry-content-title">
							<span style="display: block">Flags</span>
							<div>{Object.entries(item.Type === 'class' ? EClassFlags : EStructFlags).filter(([, flag]) => typeof flag === 'number' && item.Flags & flag).map(([a]) => a.split('_').at(-1)).join(', ')}</div>
						</div>

						{#if item.Description}
							<div class="classes__entry-info">
								<div class="classes__entry-info-name">Description</div>
								<div class="classes__entry-info-content">
									{#each item.Description.split('\n') as line}
										{#if line.length}
											<div class="">
												{line}
											</div>
										{:else}
											<br />
										{/if}
									{/each}
								</div>
							</div>
						{/if}

						<div>
							<button
								class="filter__add-button"
								on:click={() => (classTabStates[item.FullName] = 'properties')}>Properties</button
							>
							<button
								class="filter__add-button"
								on:click={() => (classTabStates[item.FullName] = 'functions')}>Functions</button
							>
						</div>

						{#if !classTabStates[item.FullName] || classTabStates[item.FullName] === 'properties'}
							<PropertyList struct={item} {replicatedOnly} parentChecksum={0} bind:fetchedStructs
							></PropertyList>
						{:else if classTabStates[item.FullName] === 'functions'}
							{#each item.Functions as func}
								{@const replicates = functionReplicates(func.Flags)}

								{#if !replicatedOnly || replicates}
									<div class="classes__entry-function">
										<div class="classes__entry-info-name">{func.Name}</div>

										<div>
											{#if func.Description}
												{#each func.Description.split('\n') as line}
													{#if line.length}
														<div class="">
															{line}
														</div>
													{:else}
														<br />
													{/if}
												{/each}
											{/if}
										</div>

										{#if replicates}
											{@const checksum = getFuncChecksum(func)}

											<div>
												<div class="classes__entry-info-name">Replay Checksum</div>
												<div class="classes__entry-info-content">
													0x{checksum.toString(16).toUpperCase()}
												</div>
											</div>
										{/if}
									</div>

									{#if func.Params?.length}
										<div style="padding-left: 50px">
											<PropertyList
												struct={item}
												properties={func.Params}
												forceShowReplicated={replicates}
												{replicatedOnly}
												parentChecksum={0}
												bind:fetchedStructs
											></PropertyList>
										</div>
									{/if}
								{/if}
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	{:else}
		<div>Loading...</div>
	{/if}
</div>

<style lang="scss">
	.filter {
		display: flex;
		justify-content: center;
		justify-items: center;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 10px;

		&__entry {
			display: flex;
			align-items: center;
			border-radius: 5px;
			background-color: #686868;
			padding: 5px;

			&-text {
				margin-right: 5px;
			}

			&-button {
				cursor: pointer;
				border: none;
				background-color: transparent;
			}
		}

		&__add {
			display: flex;
			align-items: center;
			border-radius: 5px;
			background-color: #686868;
			padding: 5px;

			&-text {
				margin-right: 5px;
			}
		}
	}

	.pagination {
		display: flex;
		justify-content: center;
		justify-items: center;
		margin-bottom: 10px;

		&__stats {
			margin-left: 10px;
		}

		&__limit-select {
			margin-left: 10px;
		}
	}

	.classes {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		flex-direction: row;
		gap: 10px;

		&__entry {
			width: 100%;
			border-radius: 5px;
			background-color: #686868;
			padding: 5px;

			&-function {
				margin-top: 10px;
				padding: 5px;
				border-radius: 5px;
				background-color: #686868;
				display: grid;
				grid-template-columns: 20% 40% 20%;
			}

			&-button {
				cursor: pointer;
				border: none;
				background-color: transparent;
				width: 100%;
				text-align: left;
				display: grid;
				grid-template-columns: 20% 20% 20%;
			}

			&-name {
				margin-right: 5px;
				font-size: 1.5em;
			}

			&-content {
				margin-top: 5px;
				padding: 5px;

				&-title {
					margin-bottom: 5px;
				}
			}

			&-info {
				&-name {
					font-weight: bold;
					margin-right: 5px;
				}

				&-content {
					flex: 1;
				}
			}
		}
	}
</style>
