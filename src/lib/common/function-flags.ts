import { EFunctionFlags } from "../../types/properties";

export const functionReplicates = (flags: number) => {
	if (!(flags & EFunctionFlags.FUNC_Net)) {
		return false;
	}

	if (flags & EFunctionFlags.FUNC_NetServer) {
		return false;
	}

	// not sure
	if (!(flags & EFunctionFlags.FUNC_NetClient) && !(flags & EFunctionFlags.FUNC_NetMulticast)) {
		return false;
	}

	return true;
};
