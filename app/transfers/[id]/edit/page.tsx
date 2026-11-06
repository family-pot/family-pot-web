import { TransferForm } from "@/src/components/transfers/transfer-form";

export default async function EditTransferPage(
  props: PageProps<"/transfers/[id]/edit">,
) {
  const { id } = await props.params;
  return <TransferForm transferId={id} />;
}
