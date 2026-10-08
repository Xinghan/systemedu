import {notFound,redirect} from "next/navigation"
export default function Page(){if(process.env.NODE_ENV!=="development")notFound();redirect("/slide-preview/molecule-v2/M02")}
