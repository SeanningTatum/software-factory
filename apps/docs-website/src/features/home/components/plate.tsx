export const PLATE = { centre: 190, half: 150, rise: 75, thick: 16, row: 72, first: 82 };

export function Plate({ index, state }: { index: number; state: "in" | "out" | "base" }) {
  const { centre, half, rise, thick } = PLATE;
  const y = PLATE.first + index * PLATE.row;
  return (
    <g className="plate" data-state={state}>
      <path className="plate-lead" d={`M${centre + half} ${y}H520`} />
      <path
        className="plate-side"
        d={`M${centre - half} ${y}L${centre} ${y + rise}v${thick}L${centre - half} ${y + thick}Z`}
      />
      <path
        className="plate-side"
        d={`M${centre + half} ${y}L${centre} ${y + rise}v${thick}L${centre + half} ${y + thick}Z`}
      />
      <path
        className="plate-top"
        d={`M${centre} ${y - rise}L${centre + half} ${y}L${centre} ${y + rise}L${centre - half} ${y}Z`}
      />
    </g>
  );
}
