import StyledSelect from './StyledSelect';
const getStatusColor = (game) => {
  if (game.hastimestamps && game.isscored) return 'green';
  if (game.hastimestamps) return 'yellow';
  return 'red';
};
const GameSelector = ({
  games,
  onChange,
  value,
  hideUploadOption = false,
}) => {
  const options = games.map((game) => ({
    value: game.id,
    label: game.title,
    color: getStatusColor(game),
    tooltip: {
      green: 'All stats and timestamps present',
      yellow: 'Timestamps present, but no scores',
      red: 'No stats or timestamps',
    }[getStatusColor(game)],
  }));
  if (!hideUploadOption) {
    options.push({
      value: 'upload-new',
      label: <em>New game...</em>,
    });
  }
  const handleChange = (selected) => {
    onChange(selected);
  };
  return (
    <>
      <StyledSelect
        options={options}
        value={value}
        onChange={handleChange}
        placeholder="Select a game..."
        showStatus
        showTooltip
      />
    </>
  );
};
export default GameSelector;
