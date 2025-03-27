
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const TutorialModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tutorial</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};