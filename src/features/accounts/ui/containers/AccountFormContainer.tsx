/* Componente de LÓGICA del modal de cuenta.

   El `accountModalOpen && <Modal/>` que estaba duplicado en el árbol móvil y en
   el de escritorio vive ahora aquí: los dos árboles montan este container y él
   decide. Devolver `null` cuando está cerrado conserva el comportamiento que
   importa — al abrirse, el modal se monta de cero y sus `useState` toman los
   valores de la cuenta que se está editando. */

import { useHiloStore } from '../../../../app/store-context';
import {
  selectAccountModalOpen,
  selectEditingAccount,
  selectEditingAccountCanDelete,
} from '../../store/selectors';
import { AccountFormModal } from '../components/AccountFormModal';

export type AccountFormContainerProps = {
  desktop?: boolean;
};

export function AccountFormContainer({ desktop }: AccountFormContainerProps) {
  const open = useHiloStore(selectAccountModalOpen);
  const account = useHiloStore(selectEditingAccount);
  const canDelete = useHiloStore(selectEditingAccountCanDelete);
  const saveAccount = useHiloStore((s) => s.saveAccount);
  const deleteAccount = useHiloStore((s) => s.deleteAccount);
  const closeAccountForm = useHiloStore((s) => s.closeAccountForm);

  if (!open) return null;

  return (
    <AccountFormModal
      account={account}
      canDelete={canDelete}
      onClose={closeAccountForm}
      onSave={saveAccount}
      onDelete={() => account && deleteAccount(account.id)}
      desktop={desktop}
    />
  );
}
