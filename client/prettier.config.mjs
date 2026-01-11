import ultracite from "ultracite/prettier";

export default {
  ...ultracite,
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindFunctions: ["cva", "cn", "clsx"], // https://github.com/tailwindlabs/tailwindcss/discussions/7558#discussioncomment-9217030
};
