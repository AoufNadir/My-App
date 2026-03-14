import { memo, type ComponentProps } from 'react';
import {
    ClientTransferDialog,
    TreasuryBalanceEditDialog,
    PortfolioBalanceEditDialog,
    DateFilterDialog
} from './MainDialogs';

type MainTransferAndFilterDialogsProps = {
    clientTransferProps: ComponentProps<typeof ClientTransferDialog>;
    treasuryBalanceEditProps: ComponentProps<typeof TreasuryBalanceEditDialog>;
    portfolioBalanceEditProps: ComponentProps<typeof PortfolioBalanceEditDialog>;
    dateFilterProps: ComponentProps<typeof DateFilterDialog>;
};

function MainTransferAndFilterDialogsComponent({
    clientTransferProps,
    treasuryBalanceEditProps,
    portfolioBalanceEditProps,
    dateFilterProps
}: MainTransferAndFilterDialogsProps) {
    return (
        <>
            <ClientTransferDialog {...clientTransferProps} />
            <TreasuryBalanceEditDialog {...treasuryBalanceEditProps} />
            <PortfolioBalanceEditDialog {...portfolioBalanceEditProps} />
            <DateFilterDialog {...dateFilterProps} />
        </>
    );
}

const areMainTransferAndFilterDialogsPropsEqual = (
    prev: MainTransferAndFilterDialogsProps,
    next: MainTransferAndFilterDialogsProps
) => (
    prev.clientTransferProps === next.clientTransferProps
    && prev.treasuryBalanceEditProps === next.treasuryBalanceEditProps
    && prev.portfolioBalanceEditProps === next.portfolioBalanceEditProps
    && prev.dateFilterProps === next.dateFilterProps
);

export const MainTransferAndFilterDialogs = memo(
    MainTransferAndFilterDialogsComponent,
    areMainTransferAndFilterDialogsPropsEqual
);
