import { signIn } from "@/auth"
 
export default function SignIn() {
  return (
    <form
      action={async () => {
        "use server"
        await signIn("google")
      }}
    >
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Sign in with Google
      </button>
    </form>
  )
}
