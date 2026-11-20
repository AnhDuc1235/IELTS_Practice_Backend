import z from "zod";
import { submitTestSchema } from "../validators/test.validate";

export type testQuery = {
    page: number;
    limit: number;
    skill?: string | undefined;
    category?: string | undefined;
}


// Parsed body of POST /test/:testId/submit (see submitTestSchema for the rules)
export type submitTestBody = z.output<typeof submitTestSchema>
