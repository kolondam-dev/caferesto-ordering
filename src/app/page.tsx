import Storefront from "./Storefront";

/**
 * Menu publik — siapa pun boleh menelusuri menu tanpa login ("cukup lihat
 * menu"), dan guest bisa memesan untuk dibayar di kasir. Aksi yang butuh akun
 * (dine-in checkout sendiri) tetap diarahkan login di Storefront.
 */
export default function HomePage() {
  return <Storefront />;
}
