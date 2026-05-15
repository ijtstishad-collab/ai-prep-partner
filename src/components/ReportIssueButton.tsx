import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function ReportIssueButton({ questionId }: { questionId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("incorrect_answer");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("question_reports").insert({
      question_id: questionId, user_id: user.id, reason, details: details || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks! Report submitted for review.");
    setOpen(false);
    setDetails("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag className="h-3.5 w-3.5 mr-1" /> Report Issue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Report a problem with this question</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="incorrect_answer">Incorrect answer</SelectItem>
                <SelectItem value="unclear_question">Unclear / confusing question</SelectItem>
                <SelectItem value="wrong_explanation">Wrong Bangla explanation</SelectItem>
                <SelectItem value="off_syllabus">Off-syllabus</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Details (optional)</Label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tell us what's wrong..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Submitting..." : "Submit report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
