import getClasses from "$lib/server/get-classes";
import { json } from "@sveltejs/kit";
import type { RequestEvent } from "./$types";

export async function GET({ url }: RequestEvent) {
  const classes = getClasses();

  const theStruct = classes.Structs.find((cls) => cls.FullName.toLowerCase() === url.searchParams.get('structname')?.toLowerCase());

  if (!theStruct) {
    return json({ error: "Struct not found" }, { status: 404 });
  }

  theStruct.Type = 'struct';

  return json(theStruct);
}
