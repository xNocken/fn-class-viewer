import getClasses from "$lib/server/get-classes";
import { json } from "@sveltejs/kit";
import type { RequestEvent } from "./$types";

export async function GET({ url }: RequestEvent) {
  const classes = getClasses();

  const theStruct = classes.Structs.find((cls) => cls.FullName.toLowerCase() === url.searchParams.get('structname')?.toLowerCase());
  const theClass = classes.Classes.find((cls) => cls.FullName.toLowerCase() === url.searchParams.get('structname')?.toLowerCase());

  if (theClass) {
    theClass.Type = 'class';

    return json(theClass);
  }

  if (theStruct) {
    theStruct.Type = 'struct';

    return json(theStruct);
  }

  return json({ error: 'Struct not found' }, { status: 404 });
}
