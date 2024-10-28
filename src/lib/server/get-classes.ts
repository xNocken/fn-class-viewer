import fs from 'node:fs';

export interface Root {
	Enums: Enum[];
	Structs: Struct[];
	Classes: Class[];
}

export interface Enum {
	Name: string;
	CppName: string;
	FullName: string;
	Members: Member[];
	Description?: string;
}

export interface Member {
	Name: string;
	Value: number;
	Description?: string;
}

export interface Struct {
	Type: 'struct';
	Name: string;
	FullName: string;
	PrefixedName: string;
	CppName: string;
	Parent: string;
	Flags: number;
	Properties: PropertyType[];
	Functions: never[];
	Description?: string;
}

export interface Class {
	Type: 'class';
	Name: string;
	FullName: string;
	PrefixedName: string;
	CppName: string;
	Parent: string;
	Flags: number;
	Properties: PropertyType[];
	Functions: Function[];
	Description?: string;
}

export interface Function {
	Name: string;
	Flags: number;
	Params: PropertyType[];
	Description?: string;
}

export interface Property {
	Name: string;
	Type: string;
	CppType: string;
	ArrayDim: number;
	Offset: number;
	Size: number;
	Flags: number;
	Description?: string;
	InnerType: string;
}

export interface DefaultProperty extends Property {
	Type: 'BoolProperty' | 'IntProperty' | 'FloatProperty' | 'StrProperty' | 'NameProperty' | 'InterfaceProperty' | 'ClassProperty' | 'WeakObjectProperty' | 'LazyObjectProperty' | 'SoftClassProperty' | 'SoftObjectProperty' | 'ObjectProperty';
}

export interface StructProperty extends Property {
	Type: 'StructProperty';
	InnerType: string;
}

export interface ArrayProperty extends Property {
	Type: 'ArrayProperty' | 'SetProperty';
	ArrayInnerType: PropertyType;
}

export interface EnumProperty extends Property {
	Type: 'EnumProperty' | 'ByteProperty';
	Enum?: Enum;
	InnerType: string;
}

export interface MapProperty extends Property {
	Type: 'MapProperty';
	KeyProperty: PropertyType;
	ValueProperty: PropertyType;
}

export type PropertyType = DefaultProperty | StructProperty | ArrayProperty | EnumProperty | MapProperty;

const cacheTime = 1000 * 60 * 60 * 24;

let cachedRoot: Root | null = null;
let cacheDate: number = 0;

const handleProperty = (prop: PropertyType, enumsByName: Record<string, Enum>) => {
	if (prop.Type === 'EnumProperty' || prop.Type === 'ByteProperty') {
		const enumm = enumsByName[prop.InnerType];

		if (enumm) {
			(<EnumProperty>prop).Enum = enumm;
		}
	}

	if (prop.Type === 'ArrayProperty' || prop.Type === 'SetProperty') {
		const innerType = prop.ArrayInnerType;

		handleProperty(innerType, enumsByName);
	}

	if (prop.Type === 'MapProperty') {
		const keyType = prop.KeyProperty;
		const valueType = prop.ValueProperty;

		handleProperty(keyType, enumsByName);
		handleProperty(valueType, enumsByName);
	}
}

export default () => {
	const cacheValid = Date.now() - cacheDate < cacheTime;

	if (cacheValid && cachedRoot) {
		return cachedRoot;
	}

	const root: Root = JSON.parse(fs.readFileSync('data/cpp-classes.json', 'utf8'));
	const desciptions = <Record<string, string>>(
		JSON.parse(fs.readFileSync('data/cpp-descriptions.json', 'utf8'))
	);
	const blueprintClasses = <Root>JSON.parse(fs.readFileSync('data/blueprint-classes.json', 'utf8'));

	const classesByFullname: Record<string, Class> = {};
	const structsByFullname: Record<string, Struct> = {};
	const enumsByName: Record<string, Enum> = {};

	root.Classes.push(...blueprintClasses.Classes);
	root.Enums.push(...blueprintClasses.Enums);
	root.Structs.push(...blueprintClasses.Structs);

	root.Classes.forEach((cls) => {
		classesByFullname[cls.FullName] = cls;
	});

	root.Structs.forEach((str) => {
		structsByFullname[str.FullName] = str;
	});

	root.Enums.forEach((enum_) => {
		enumsByName[enum_.FullName] = enum_;
	});

	cachedRoot = root;
	cacheDate = Date.now();

	[
		...root.Classes,
		...root.Structs
	].forEach((cls) => {
		const classDesc = desciptions[cls.Name];

		if (classDesc) {
			cls.Description = classDesc;
		}

		cls.Properties.forEach((prop) => {
			const propDesc = desciptions[`${cls.Name}:${prop.Name}`];

			if (propDesc) {
				prop.Description = propDesc;
			}

			handleProperty(prop, enumsByName);
		});

		cls.Functions.forEach((func) => {
			const funcDesc = desciptions[`${cls.Name}:${func.Name}`];

			if (!funcDesc) {
				return;
			}

			const descLines = funcDesc.split('\n').map((line) => line.trim());

			let lastParam: PropertyType | undefined = undefined;

			let desc = '';

			descLines.forEach((line) => {
				if (line.startsWith('@')) {
					if (line.toLowerCase().startsWith('@param')) {
						const match = line.match(/@param\s+(\w+)\s+(.*)/i);

						if (!match) {
							return;
						}

						const [, paramName, paramDesc] = match;

						lastParam = func.Params.find((p) => p.Name === paramName);

						if (lastParam) {
							lastParam.Description = paramDesc;
						}

						return;
					}

					// some special type we dont handle. assumably its something new so we dont want to append to the last param desc
					lastParam = undefined;
				}

				if (lastParam) {
					lastParam.Description += '\n' + line;
					return;
				}

				desc += line + '\n';
			});

			func.Description = desc.trim();

			func.Params.forEach((param) => {
				handleProperty(param, enumsByName);
			})
		});
	});

	root.Enums.forEach((enum_) => {
		const enumDesc = desciptions[enum_.Name];

		if (enumDesc) {
			enum_.Description = enumDesc;
		}

		enum_.Members.forEach((member) => {
			const memberDesc = desciptions[`${enum_.Name}.${member.Name}`];

			if (memberDesc) {
				member.Description = memberDesc;
			}
		});
	});

	return root;
};
