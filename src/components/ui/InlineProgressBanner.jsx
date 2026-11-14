import { InlineProgressBanner as KitBanner } from '@aspectum/admin-ui-web';

export default function InlineProgressBanner({ show = true, ...props }) {
  return <KitBanner show={show} {...props} />;
}
