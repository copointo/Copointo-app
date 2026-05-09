const MALE = require("../assets/images/avatar-male.png");
const FEMALE = require("../assets/images/avatar-female.png");

export type Gender = "male" | "female" | undefined;

/** Returns a default avatar image source based on the user's gender. */
export function getDefaultAvatarSource(gender?: Gender): number {
  return gender === "female" ? FEMALE : MALE;
}
