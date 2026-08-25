import PautaCliente from "@/componentes/PautaCliente";

export const metadata = {
  title: "Pauta · próximas entregas",
  description: "Entregas combinadas para hoje e os próximos 7 dias.",
};

export default function Cliente() {
  return <PautaCliente />;
}
