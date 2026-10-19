import ChoiceGroup from './ChoiceGroup';

export default function ToggleGroup(props) {
  return <ChoiceGroup {...props} multiple tone="primary" value={props.value || []} />;
}
