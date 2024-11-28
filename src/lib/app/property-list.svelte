<script lang="ts">
	import { getCmdChecksum } from '$lib/common/checksum-generator';
	import type { Class, PropertyType, Struct } from '$lib/server/get-classes';
	import { EPropertyFlags, EStructFlags } from '../../types/properties';
	import PropertyList from './property-list.svelte';

	export let struct: Struct | Class;
	export let fetchedStructs: Record<string, Struct>;
	export let properties: PropertyType[] | null = null;
	export let replicatedOnly: boolean = false;
	export let forceShowReplicated: boolean = false;
	export let forceHideReplicated: boolean = false;
	export let parentChecksum = 0;

	const getStruct = (structName: string | undefined): Struct => {
		if (!structName) {
			throw new Error('Struct name is undefined');
		}

		if (fetchedStructs[structName]) {
			return fetchedStructs[structName];
		}

		const res = fetch(`/api/get-struct?structname=${encodeURIComponent(structName)}`);

		res.then(async (res) => {
			fetchedStructs[structName] = await res.json();

			fetchedStructs = fetchedStructs;
		});

		return fetchedStructs[structName];
	};

	const getPropType = (prop: PropertyType): string => {
		if (prop.Type === 'ArrayProperty') {
			return `${prop.Type}<${getPropType(prop.ArrayInnerType)}>`;
		}

		if (prop.InnerType) {
			return `${prop.Type}<${prop.InnerType.split('.')[1] ?? prop.InnerType}>`;
		}

		return prop.Type;
	};

	const expandedProps: Record<string, boolean> = {};
	let parentExpanded = false;
</script>

{#if struct.Parent && struct.Parent !== 'None'}
	<div class="classes-properties__entry-parent">
		Parent props
		
		<button class="btn btn-primary" on:click={() => (parentExpanded = !parentExpanded)}>
			{parentExpanded ? 'V' : '>'}
		</button>
	</div>

	{#if parentExpanded}
		{@const innerStruct = getStruct(struct.Parent)}

		{#if innerStruct}
			<div class="classes-properties__entry-short" style="margin-bottom: 20px; margin-left: 50px;">
				<div>
					{Object.entries(EStructFlags)
						.filter(([, flag]) => typeof flag === 'number' && innerStruct.Flags & flag)
						.map(([a]) => a.split('_').at(-1))
						.join(', ')}
				</div>

				<div>
					{#if innerStruct.Description}
						{#each innerStruct.Description.split('\n') as line}
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
			</div>
		{/if}

		<div class="classes-properties__subentry">
			{#if innerStruct}
				<PropertyList
					struct={innerStruct}
					{forceHideReplicated}
					{replicatedOnly}
					bind:fetchedStructs
					{parentChecksum}
				/>
			{:else}
				Loading...
			{/if}
		</div>
	{/if}
{/if}

<div class="classes-properties">
	{#if !(properties ?? struct?.Properties)?.length}
		<div class="classes-properties__entry">No properties found</div>
	{/if}

	{#each properties ?? struct?.Properties as prop}
		{@const replicates =
			!forceHideReplicated &&
			(forceShowReplicated ||
				(struct.Type === 'struct'
					? !(prop.Flags & EPropertyFlags.RepSkip)
					: Boolean(prop.Flags & EPropertyFlags.Net)))}

		{#each Array.from({ length: prop.ArrayDim ?? 1 }).map((_, i) => i) as arrayIndex}
			{@const propertyIndex = `${prop.Name}[${arrayIndex}]`}
			{@const checksum = replicates ? getCmdChecksum(prop, arrayIndex, parentChecksum) : 0}

			{#if !replicatedOnly || replicates}
				<div class="classes-properties__entry">
					<div class="classes-properties__entry-text text-overflow-ellipsis" title={prop.Name}>
						{prop.Name}
					</div>

					<div
						class="classes-properties__entry-text text-overflow-ellipsis"
						title={getPropType(prop)}
					>
						{#if prop.Type === 'StructProperty' || prop.Type === 'ArrayProperty' || prop.Type === 'EnumProperty' || (prop.Type === 'ByteProperty' && prop.InnerType)}
							<button
								class="btn btn-primary"
								on:click={() => (
									(expandedProps[propertyIndex] = !expandedProps[propertyIndex]), console.log(prop)
								)}
							>
								{expandedProps[propertyIndex] ? 'V' : '>'}
							</button>
						{/if}

						{getPropType(prop)}
					</div>

					<div class="classes-properties__entry-text">
						{#each (prop.Description ?? 'Who @s evan to tell him to add a description?').split('\n') as line}
							{#if line.length}
								<div class="">
									{line}
								</div>
							{:else}
								<br />
							{/if}
						{/each}
					</div>

					<div class="classes-properties__entry-text">
						{#if replicates}
							<span style="display: block; margin-bottom: 4px">Replay Checksum</span>
							0x{checksum.toString(16).toUpperCase()}
						{/if}
					</div>

					<div class="classes-properties__entry-text">
						<span style="display: block; margin-bottom: 4px">Flags</span>
						{#if prop.Flags}
							<div>
								{Object.entries(EPropertyFlags)
									.filter(
										([, flag]) => typeof flag === 'number' && BigInt(prop.Flags) & BigInt(flag),
									)
									.map(([a]) => a.split('_').at(-1))
									.join(', ')}
							</div>
						{:else}
							<div>None</div>
						{/if}
					</div>
				</div>

				{#if prop.Type === 'StructProperty'}
					{#if expandedProps[propertyIndex]}
						{@const innerStruct = getStruct(prop.InnerType)}

						{#if innerStruct}
							<div
								class="classes-properties__entry-short"
								style="margin-bottom: 20px; margin-left: 50px;"
							>
								<div>
									{Object.entries(EStructFlags)
										.filter(([, flag]) => typeof flag === 'number' && innerStruct.Flags & flag)
										.map(([a]) => a.split('_').at(-1))
										.join(', ')}
								</div>

								<div>
									{#if innerStruct.Description}
										{#each innerStruct.Description.split('\n') as line}
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
							</div>
						{/if}

						<div class="classes-properties__subentry">
							{#if innerStruct}
								<PropertyList
									struct={innerStruct}
									forceHideReplicated={!replicates}
									{replicatedOnly}
									bind:fetchedStructs
									parentChecksum={checksum}
								/>
							{:else}
								Loading...
							{/if}
						</div>
					{/if}
				{/if}

				{#if prop.Type === 'ArrayProperty'}
					{#if expandedProps[propertyIndex]}
						<div class="classes-properties__subentry">
							<PropertyList
								{struct}
								properties={[prop.ArrayInnerType]}
								forceShowReplicated={replicates}
								forceHideReplicated={!replicates}
								{replicatedOnly}
								bind:fetchedStructs
								parentChecksum={checksum}
							/>
						</div>
					{/if}
				{/if}

				{#if (prop.Type === 'EnumProperty' || (prop.Type === 'ByteProperty' && prop.InnerType)) && prop.Enum}
					{#if expandedProps[propertyIndex]}
						<div class="classes-properties__subentry">
							<div class="classes-properties__entry-short" style="margin-bottom: 20px">
								<div>
									{prop.Enum.Name}
								</div>

								<div>
									{#if prop.Enum.Description}
										{#each prop.Enum.Description.split('\n') as line}
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
							</div>

							{#each prop.Enum.Members as entry}
								<div class="classes-properties__entry-short">
									<div>
										{entry.Name} = {entry.Value}
									</div>

									<div>
										{#if entry.Description}
											{#each entry.Description.split('\n') as line}
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
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			{/if}
		{/each}
	{/each}
</div>

<style lang="scss">
	.classes-properties {
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
			display: grid;
			grid-template-columns: 20% 10% 30% 10% 25%;
			gap: 10px;

			&-parent {
				padding: 5px;
				margin-bottom: 10px;
			}
		}

		&__entry-short {
			width: 100%;
			border-radius: 5px;
			background-color: #686868;
			padding: 5px;
			display: grid;
			grid-template-columns: 20% 30%;
			gap: 10px;
		}

		&__subentry {
			width: 100%;
			padding-left: 50px;
		}
	}
</style>
