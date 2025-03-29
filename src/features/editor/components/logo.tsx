import Link from "next/link";
import Image from "next/image";

export const Logo = ({ isTrial }: { isTrial?: boolean}) => {
  let backRoute = isTrial ? "/try" : "/";

  return (
    <Link href={backRoute}>
      <div className="size-8 relative shrink-0">
        <Image
          src="/zeptaframe-logo.svg"
          fill
          alt="Zeptaframe"
          className="shrink-0 hover:opacity-75 transition"
        />
      </div>
    </Link>
  );
};
