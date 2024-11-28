import getClasses, { type Class, type Struct } from '$lib/server/get-classes';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { functionReplicates } from '$lib/common/function-flags';

const modsRegex = /^[!" .]+/;

// not - !
// exact - "
// match case - .
const matches = (className: string, filter: string) => {
	const modsMatch = filter.match(modsRegex);
	const mods = modsMatch ? modsMatch[0] : '';

	const filterName = filter.replace(modsRegex, '');

	const theClassName = mods.includes('.') ? className : className.toLowerCase();
	const theFilterName = mods.includes('.') ? filterName : filterName.toLowerCase();

	let matching = false;

	if (mods.includes('"')) {
		matching = theClassName === theFilterName;
	} else {
		matching = theClassName.includes(theFilterName);
	}

	if (mods.includes('!')) {
		matching = !matching;
	}

	return matching;
};

const getFilters = (filters: string[]) => {
	const returnVal = {
		name: <string[]>[],
		extends: <string[]>[],
		deepextends: <string[]>[],
		namespace: <string[]>[],
		has: <string[]>[],
		hasprop: <string[]>[],
	};

	filters.forEach((filter) => {
		const [keyUpper, value] = filter.split(':');
		const key = keyUpper.toLowerCase();

		if (!value) {
			returnVal.name.push(keyUpper);

			return;
		}

		if (!(key in returnVal)) {
			throw new Error(`Invalid filter key: ${key}`);
		}

		returnVal[<keyof typeof returnVal>key].push(value);
	});

	return returnVal;
};

export async function POST({ request }: RequestEvent) {
	const data = await request.json();
	const filterStrings = data.filters as string[];
	const limitPerPage = data.limitPerPage as number;
	const page = data.page as number;

	const filters = getFilters(filterStrings);

	const classes = getClasses();

	const classMap = new Map<string, Class | Struct>();

	classes.Classes.forEach((c) => classMap.set(c.FullName, c));
	classes.Structs.forEach((c) => classMap.set(c.FullName, c));

	const deepExtends = (classToCheck: string, classToExtend: string) => {
		if (!classToCheck) {
			return false;
		}

		const cls = classMap.get(classToCheck);

		if (!cls) {
			return false;
		}

		if (matches(cls?.Name, classToExtend)) {
			return true;
		}

		return deepExtends(cls.Parent, classToExtend);
	};

	const filteredClasses = classes.Classes.filter((c) => {
		c.Type = 'class';

		if (filters.name.length > 0 && !filters.name.every((n) => matches(c.Name, n))) {
			return false;
		}

		if (filters.extends.length > 0 && !filters.extends.every((e) => matches(c.Parent, e))) {
			return false;
		}

		if (
			filters.deepextends.length > 0 &&
			!filters.deepextends.every((e) => deepExtends(c.FullName, e))
		) {
			return false;
		}

		if (
			filters.namespace.length > 0 &&
			!filters.namespace.every((n) => matches(c.FullName.split('.')[0], n))
		) {
			return false;
		}

		if (filters.has.length) {
			const lowerCaseHas = filters.has.map((h) => h.toLowerCase());

			if (lowerCaseHas.includes('properties')) {
				if (c.Properties.length === 0) {
					return false;
				}
			}

			if (lowerCaseHas.includes('functions')) {
				if (c.Functions.length === 0) {
					return false;
				}
			}

			if (lowerCaseHas.includes('repfunctions')) {
				if (c.Functions.filter((f) => functionReplicates(f.Flags)).length === 0) {
					return false;
				}
			}
		}

		if (filters.hasprop.length) {
			if (!filters.hasprop.every((h) => c.Properties.length && c.Properties.some((p) => matches(p.Name, h)))) {
				return false;
			}
		}

		return true;
	});

	const filteredStructs = classes.Structs.filter((c) => {
		c.Type = 'struct';

		if (filters.name.length > 0 && !filters.name.every((n) => matches(c.Name, n))) {
			return false;
		}

		if (filters.extends.length > 0 && !filters.extends.every((e) => matches(c.Parent, e))) {
			return false;
		}

		if (
			filters.deepextends.length > 0 &&
			!filters.deepextends.every((e) => deepExtends(c.Name, e))
		) {
			return false;
		}

		if (
			filters.namespace.length > 0 &&
			!filters.namespace.every((n) => matches(c.FullName.split('.')[0], n))
		) {
			return false;
		}

		if (filters.hasprop.length) {
			if (!filters.hasprop.every((h) => c.Properties.length && c.Properties.some((p) => matches(p.Name, h)))) {
				return false;
			}
		}

		return true;
	});

	const paginatedClasses = [
		...filteredClasses,
		...filteredStructs,
	].slice(page * limitPerPage, (page + 1) * limitPerPage);

	return json({
		classes: {
			Classes: paginatedClasses,
		},
		total: filteredClasses.length,
		totalPages: Math.ceil(filteredClasses.length / limitPerPage),
	});
}
