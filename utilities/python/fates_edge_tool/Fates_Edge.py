import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import json
import os
import random
from datetime import datetime

# -------------------------------
# Data Models
# -------------------------------
DEFAULT_PLAYER_DATA = {
    "identity": {"name": "", "heritage": "", "patron": "", "tier": 1, "xp": 0},
    "attributes": {"body": 1, "wits": 1, "spirit": 1, "presence": 1},
    "skills": {
        # Core 16 skills
        "melee": 0, "ranged": 0, "unarmed": 0,
        "athletics": 0, "stealth": 0, "endurance": 0, "craft": 0,
        "sway": 0, "deception": 0, "subterfuge": 0, "performance": 0, "insight": 0,
        "lore": 0, "investigation": 0, "medicine": 0, "arcana": 0
    },
    "resources": {
        "fatigue": 0, "harm": 0, "boons": 0, "momentum": 0,
        "obligation": 0, "corruption": 0, "leash": 0
    },
    "talents": [],
    "assets": [],
    "followers": [],
    "debt_timers": [],
    "bonds": "",
    "strings": "",
    "notes": ""
}

DEFAULT_GM_DATA = {
    "campaign": {
        "name": "New Campaign",
        "mandate": 0,
        "crisis": 0,
        "session": 1,
        "last_session": ""
    },
    "clocks": [],
    "factions": [],
    "patrons": [],
    "trust": {
        "name": "Party Trust",
        "tier": 1,
        "xp": 0,
        "assets": [],
        "followers": []
    },
    "rivals": [],
    "notes": ""
}

# -------------------------------
# Helper Functions
# -------------------------------
def armor_conversion(harm_in, armor_type):
    # Full conversion table
    table = {
        'Light':    {1: (1,0), 2: (1,1), 3: (1,2), 4: (1,3), 5: (1,4)},
        'Medium':   {1: (1,0), 2: (1,0), 3: (1,2), 4: (1,3), 5: (1,4)},
        'Heavy':    {1: (1,0), 2: (1,0), 3: (2,0), 4: (2,1), 5: (2,2)},
        'Superior': {1: (1,0), 2: (1,0), 3: (1,0), 4: (3,0), 5: (3,1)},
        'Mythic':   {1: (1,0), 2: (1,0), 3: (1,0), 4: (1,0), 5: (4,0)}
    }
    if harm_in < 1:
        harm_in = 1
    if harm_in > 5:
        harm_in = 5
    fatigue, harm_rem = table.get(armor_type, table['Light'])[harm_in]
    if fatigue < 1:
        fatigue = 1
    return fatigue, harm_rem

def attr_cost(new_rating):
    # Cost to increase from (new_rating-1) to new_rating
    return new_rating * 3

def skill_cost(new_level):
    # Cost to increase from (new_level-1) to new_level
    return new_level * 2

def attr_total_cost(rating):
    # Total cost to raise from 1 to rating (incremental sum)
    # sum_{i=2..rating} i*3 = 3*(sum_{i=2..rating} i) = 3*((rating*(rating+1)//2) - 1)
    return 3 * ((rating * (rating + 1) // 2) - 1)

def skill_total_cost(level):
    # Total cost to raise from 0 to level: sum_{i=1..level} i*2 = 2*(level*(level+1)//2)
    return level * (level + 1)

# -------------------------------
# Main Application
# -------------------------------
class FateEdgeApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Fate's Edge Unified Tool")
        self.root.geometry("1100x800")
        self.root.configure(bg="#f0f0f0")

        self.player_file = "fate_edge_player.json"
        self.gm_file = "fate_edge_gm.json"
        self.talent_file = "talents.json"

        self.load_data()
        self.load_talents()

        self.roll_history = []

        self.notebook = ttk.Notebook(root)
        self.notebook.pack(fill='both', expand=True, padx=10, pady=10)

        self.create_character_tab()
        self.create_dice_tab()
        self.create_gm_tab()
        self.create_history_tab()

        root.protocol("WM_DELETE_WINDOW", self.on_close)
        self.refresh_all_display()

    def load_data(self):
        if os.path.exists(self.player_file):
            try:
                with open(self.player_file, 'r') as f:
                    self.player_data = json.load(f)
                # Ensure all keys exist
                for key in DEFAULT_PLAYER_DATA:
                    if key not in self.player_data:
                        self.player_data[key] = DEFAULT_PLAYER_DATA[key]
                # Ensure all skills exist (in case of old version)
                for sk in DEFAULT_PLAYER_DATA["skills"]:
                    if sk not in self.player_data["skills"]:
                        self.player_data["skills"][sk] = 0
            except Exception as e:
                print(f"Error loading player data: {e}")
                self.player_data = DEFAULT_PLAYER_DATA.copy()
        else:
            self.player_data = DEFAULT_PLAYER_DATA.copy()
            self.save_player_data()

        if os.path.exists(self.gm_file):
            try:
                with open(self.gm_file, 'r') as f:
                    self.gm_data = json.load(f)
                if "campaign" not in self.gm_data:
                    self.gm_data["campaign"] = DEFAULT_GM_DATA["campaign"]
                if "trust" not in self.gm_data:
                    self.gm_data["trust"] = DEFAULT_GM_DATA["trust"]
            except Exception as e:
                print(f"Error loading GM data: {e}")
                self.gm_data = DEFAULT_GM_DATA.copy()
        else:
            self.gm_data = DEFAULT_GM_DATA.copy()
            self.save_gm_data()

    def save_player_data(self):
        try:
            with open(self.player_file, 'w') as f:
                json.dump(self.player_data, f, indent=2)
        except Exception as e:
            print(f"Error saving player data: {e}")

    def save_gm_data(self):
        try:
            with open(self.gm_file, 'w') as f:
                json.dump(self.gm_data, f, indent=2)
        except Exception as e:
            print(f"Error saving GM data: {e}")

    def load_talents(self):
        # Load from talent file or use empty list
        if os.path.exists(self.talent_file):
            try:
                with open(self.talent_file, 'r') as f:
                    self.talent_library = json.load(f)
            except:
                self.talent_library = []
        else:
            self.talent_library = []
            try:
                with open(self.talent_file, 'w') as f:
                    json.dump(self.talent_library, f, indent=2)
            except:
                pass

    def on_close(self):
        self.save_player_data()
        self.save_gm_data()
        self.root.destroy()

    def open_builder_wizard(self):
        """Launch the character builder wizard with live XP tracking and validation."""
        wizard = tk.Toplevel(self.root)
        wizard.title("Character Builder Wizard")
        wizard.geometry("800x700")
        wizard.transient(self.root)
        wizard.grab_set()

        # Temporary data store
        temp_data = {
            "identity": {"name": "", "heritage": "", "patron": ""},
            "attributes": {"body": 1, "wits": 1, "spirit": 1, "presence": 1},
            "skills": {s: 0 for s in DEFAULT_PLAYER_DATA["skills"]},
            "talents": [],
            "resources": {"boons": 0, "fatigue": 0, "harm": 0, "momentum": 0,
                          "obligation": 0, "corruption": 0, "leash": 0},
            "assets": [],
            "followers": [],
            "debt_timers": [],
            "bonds": 0,
            "complications": 0,
            "xp_spent": 0,
            "starting_xp": 32
        }

        pages = []
        current_page = 0

        # ---------- Navigation ----------
        def next_page():
            nonlocal current_page
            if current_page < len(pages) - 1:
                current_page += 1
                show_page(current_page)

        def prev_page():
            nonlocal current_page
            if current_page > 0:
                current_page -= 1
                show_page(current_page)

        def show_page(index):
            for i, frame in enumerate(pages):
                frame.pack_forget() if i != index else frame.pack(fill='both', expand=True)
            update_nav_buttons()
            if index == len(pages) - 1:
                update_summary()

        def update_nav_buttons():
            btn_back.config(state="normal" if current_page > 0 else "disabled")
            if current_page == len(pages) - 1:
                btn_next.config(text="Finish", command=finish_wizard)
            else:
                btn_next.config(text="Next →", command=next_page)

        # ---------- Finish ----------
        def finish_wizard():
            # Recalculate spent to be safe
            spent = 0
            for attr, val in temp_data["attributes"].items():
                spent += attr_total_cost(val)
            for skill, val in temp_data["skills"].items():
                spent += skill_total_cost(val)
            for t in temp_data["talents"]:
                spent += t.get("cost", 2)
            temp_data["xp_spent"] = spent

            bonus = temp_data["bonds"] * 2 + temp_data["complications"] * 2
            max_xp = 32 + bonus
            if spent > max_xp:
                messagebox.showerror("Too Much XP",
                                     f"You've spent {spent} XP, but only have {max_xp} (32 + {bonus} from Bonds/Complications).")
                return

            # Apply to main player data
            self.player_data["identity"]["name"] = temp_data["identity"]["name"]
            self.player_data["identity"]["heritage"] = temp_data["identity"]["heritage"]
            self.player_data["identity"]["patron"] = temp_data["identity"]["patron"]
            self.player_data["identity"]["tier"] = 1
            self.player_data["identity"]["xp"] = max_xp - spent  # leftover XP
            for attr in temp_data["attributes"]:
                self.player_data["attributes"][attr] = temp_data["attributes"][attr]
            for skill in temp_data["skills"]:
                self.player_data["skills"][skill] = temp_data["skills"][skill]
            self.player_data["talents"] = temp_data["talents"]
            for res in temp_data["resources"]:
                self.player_data["resources"][res] = temp_data["resources"][res]
            self.player_data["assets"] = temp_data["assets"]
            self.player_data["followers"] = temp_data["followers"]
            self.player_data["debt_timers"] = temp_data["debt_timers"]
            self.player_data["bonds"] = f"{temp_data['bonds']} Bond(s) taken"
            if temp_data["complications"]:
                self.player_data["notes"] = f"Complications: {temp_data['complications']}\n" + self.player_data.get("notes", "")
            self.save_player_data()
            self.refresh_character_display()
            wizard.destroy()
            messagebox.showinfo("Success", "Character created!")

        # ---------- Summary update ----------
        def update_summary():
            summary_text.delete('1.0', tk.END)
            summary_text.insert('end', f"Name: {name_var.get()}\n")
            summary_text.insert('end', f"Heritage: {heritage_var.get()}\n")
            summary_text.insert('end', f"Patron: {patron_var.get()}\n\n")
            summary_text.insert('end', "Attributes:\n")
            for attr, var in attr_vars.items():
                val = var.get()
                summary_text.insert('end', f"  {attr.title()}: {val} (total cost {attr_total_cost(val)} XP)\n")
            summary_text.insert('end', "\nSkills:\n")
            for skill, var in skill_vars.items():
                val = var.get()
                if val > 0:
                    summary_text.insert('end', f"  {skill.title()}: {val} (total cost {skill_total_cost(val)} XP)\n")
            summary_text.insert('end', f"\nTalents: {len(temp_data['talents'])}\n")
            for t in temp_data["talents"]:
                summary_text.insert('end', f"  {t['name']} (adj {t['die_adjustment']:+d}) [cost {t.get('cost',2)} XP]\n")
            summary_text.insert('end', f"\nBonds: {bonds_var.get()}, Complications: {comps_var.get()}\n")
            total_bonus = bonds_var.get() * 2 + comps_var.get() * 2
            summary_text.insert('end', f"Total XP available: {32 + total_bonus}\n")
            spent = 0
            for attr, var in attr_vars.items():
                spent += attr_total_cost(var.get())
            for skill, var in skill_vars.items():
                spent += skill_total_cost(var.get())
            for t in temp_data["talents"]:
                spent += t.get("cost", 2)
            temp_data["xp_spent"] = spent
            summary_text.insert('end', f"XP spent: {spent}\n")
            if spent > 32 + total_bonus:
                summary_text.insert('end', "⚠️ WARNING: You have overspent XP!\n", 'warning')
            else:
                summary_text.insert('end', f"Remaining XP: {32 + total_bonus - spent}\n")
            summary_text.insert('end', "\nStarting Resources:\n")
            for key, var in res_vars.items():
                summary_text.insert('end', f"  {key.title()}: {var.get()}\n")

        # ---------- Build Pages ----------
        # Page 1: Identity
        p1 = ttk.Frame(wizard)
        ttk.Label(p1, text="Step 1: Identity", font=('Arial', 14, 'bold')).pack(pady=10)
        f1 = ttk.Frame(p1)
        f1.pack(fill='x', padx=20, pady=5)
        ttk.Label(f1, text="Name:").grid(row=0, column=0, sticky='w')
        name_var = tk.StringVar()
        ttk.Entry(f1, textvariable=name_var, width=30).grid(row=0, column=1, padx=5)
        ttk.Label(f1, text="Heritage:").grid(row=1, column=0, sticky='w')
        heritage_var = tk.StringVar()
        ttk.Entry(f1, textvariable=heritage_var, width=30).grid(row=1, column=1, padx=5)
        ttk.Label(f1, text="Patron:").grid(row=2, column=0, sticky='w')
        patron_var = tk.StringVar()
        ttk.Entry(f1, textvariable=patron_var, width=30).grid(row=2, column=1, padx=5)
        pages.append(p1)

        # Page 2: Attributes
        p2 = ttk.Frame(wizard)
        ttk.Label(p2, text="Step 2: Attributes (total cost from rating 1)", font=('Arial', 14, 'bold')).pack(pady=10)
        attr_frame = ttk.Frame(p2)
        attr_frame.pack(fill='x', padx=20, pady=5)
        attr_vars = {}
        attr_cost_labels = {}
        for i, name in enumerate(["Body", "Wits", "Spirit", "Presence"]):
            key = name.lower()
            ttk.Label(attr_frame, text=name + ":").grid(row=i, column=0, sticky='w', padx=5)
            var = tk.IntVar(value=1)
            attr_vars[key] = var
            spin = ttk.Spinbox(attr_frame, from_=1, to=5, textvariable=var, width=4)
            spin.grid(row=i, column=1, padx=5)
            cost_lbl = ttk.Label(attr_frame, text=f"Total: {attr_total_cost(var.get())} XP")
            cost_lbl.grid(row=i, column=2, padx=5)
            attr_cost_labels[key] = cost_lbl

            def make_updater(k, lbl, v):
                def upd(*args):
                    val = v.get()
                    lbl.config(text=f"Total: {attr_total_cost(val)} XP")
                    # update temp_data
                    temp_data["attributes"][k] = val
                return upd

            var.trace('w', make_updater(key, cost_lbl, var))
            # initialise
            temp_data["attributes"][key] = var.get()
        pages.append(p2)

        # Page 3: Skills
        p3 = ttk.Frame(wizard)
        ttk.Label(p3, text="Step 3: Skills (total cost from level 0)", font=('Arial', 14, 'bold')).pack(pady=10)
        skill_frame = ttk.Frame(p3)
        skill_frame.pack(fill='both', expand=True, padx=20, pady=5)
        canvas = tk.Canvas(skill_frame, height=250)
        scroll = ttk.Scrollbar(skill_frame, orient='vertical', command=canvas.yview)
        scrollable = ttk.Frame(canvas)
        scrollable.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=scrollable, anchor='nw')
        canvas.configure(yscrollcommand=scroll.set)
        canvas.pack(side='left', fill='both', expand=True)
        scroll.pack(side='right', fill='y')

        skill_vars = {}
        skill_cost_labels = {}
        skill_list = list(DEFAULT_PLAYER_DATA["skills"].keys())
        for idx, skill in enumerate(skill_list):
            frame = ttk.Frame(scrollable)
            frame.grid(row=idx // 4, column=idx % 4, padx=5, pady=2, sticky='w')
            ttk.Label(frame, text=skill.title() + ":").pack(side='left')
            var = tk.IntVar(value=0)
            skill_vars[skill] = var
            spin = ttk.Spinbox(frame, from_=0, to=5, textvariable=var, width=3)
            spin.pack(side='left', padx=2)
            cost_lbl = ttk.Label(frame, text=f"Total: {skill_total_cost(var.get())} XP")
            cost_lbl.pack(side='left', padx=2)
            skill_cost_labels[skill] = cost_lbl

            def make_skill_updater(sk, lbl, v):
                def upd(*args):
                    val = v.get()
                    lbl.config(text=f"Total: {skill_total_cost(val)} XP")
                    temp_data["skills"][sk] = val
                return upd

            var.trace('w', make_skill_updater(skill, cost_lbl, var))
            # initialise
            temp_data["skills"][skill] = var.get()
        pages.append(p3)

        # Page 4: Talents
        p4 = ttk.Frame(wizard)
        ttk.Label(p4, text="Step 4: Talents", font=('Arial', 14, 'bold')).pack(pady=10)
        talent_listbox = tk.Listbox(p4, height=6)
        talent_listbox.pack(fill='x', padx=20, pady=5)

        talent_entry_frame = ttk.Frame(p4)
        talent_entry_frame.pack(fill='x', padx=20, pady=5)

        # Library combo
        ttk.Label(talent_entry_frame, text="Library:").pack(side='left')
        talent_names = sorted([t["name"] for t in self.talent_library]) if self.talent_library else ["(no talents loaded)"]
        self.wizard_talent_var = tk.StringVar()
        talent_combo = ttk.Combobox(talent_entry_frame, textvariable=self.wizard_talent_var,
                                    values=talent_names, width=20, state="readonly")
        talent_combo.pack(side='left', padx=2)

        # Custom fields
        ttk.Label(talent_entry_frame, text="Name:").pack(side='left', padx=(10, 0))
        talent_name = tk.StringVar()
        ttk.Entry(talent_entry_frame, textvariable=talent_name, width=12).pack(side='left', padx=2)
        ttk.Label(talent_entry_frame, text="Adj:").pack(side='left')
        talent_die = tk.IntVar(value=0)
        ttk.Spinbox(talent_entry_frame, from_=-5, to=5, textvariable=talent_die, width=4).pack(side='left', padx=2)
        ttk.Label(talent_entry_frame, text="Cond:").pack(side='left')
        talent_cond = tk.StringVar()
        ttk.Entry(talent_entry_frame, textvariable=talent_cond, width=10).pack(side='left', padx=2)
        ttk.Label(talent_entry_frame, text="Cost:").pack(side='left')
        talent_cost = tk.IntVar(value=2)
        ttk.Spinbox(talent_entry_frame, from_=1, to=15, textvariable=talent_cost, width=4).pack(side='left', padx=2)

        # Buttons
        btn_frame = ttk.Frame(talent_entry_frame)
        btn_frame.pack(side='left', padx=5)

        def add_talent_from_library():
            selected = self.wizard_talent_var.get()
            if selected and selected != "(no talents loaded)":
                for t in self.talent_library:
                    if t["name"] == selected:
                        talent = t.copy()
                        temp_data["talents"].append(talent)
                        talent_listbox.insert(tk.END,
                                              f"{talent['name']} (adj {talent['die_adjustment']:+d}) [{talent.get('condition','')}]")
                        break

        def add_custom_talent():
            name = talent_name.get().strip()
            if not name:
                messagebox.showwarning("Missing Name", "Please enter a talent name.")
                return
            talent = {
                "name": name,
                "die_adjustment": talent_die.get(),
                "condition": talent_cond.get().strip(),
                "cost": talent_cost.get()
            }
            temp_data["talents"].append(talent)
            talent_listbox.insert(tk.END,
                                  f"{name} (adj {talent['die_adjustment']:+d}) [{talent['condition']}]")
            talent_name.set("")
            talent_die.set(0)
            talent_cond.set("")
            talent_cost.set(2)

        def remove_talent():
            sel = talent_listbox.curselection()
            if sel:
                idx = sel[0]
                if idx < len(temp_data["talents"]):
                    del temp_data["talents"][idx]
                    talent_listbox.delete(idx)

        ttk.Button(btn_frame, text="Add from Library", command=add_talent_from_library).pack(side='left', padx=2)
        ttk.Button(btn_frame, text="Add Custom", command=add_custom_talent).pack(side='left', padx=2)
        ttk.Button(btn_frame, text="Remove Selected", command=remove_talent).pack(side='left', padx=2)
        pages.append(p4)

        # Page 5: Bonds & Complications
        p5 = ttk.Frame(wizard)
        ttk.Label(p5, text="Step 5: Bonds & Complications (each gives +2 XP, max +4 total)",
                  font=('Arial', 14, 'bold')).pack(pady=10)
        f5 = ttk.Frame(p5)
        f5.pack(fill='x', padx=20, pady=5)
        ttk.Label(f5, text="Number of Bonds (0-2):").grid(row=0, column=0, sticky='w')
        bonds_var = tk.IntVar(value=0)
        ttk.Spinbox(f5, from_=0, to=2, textvariable=bonds_var, width=4).grid(row=0, column=1, padx=5)
        ttk.Label(f5, text="Number of Complications (0-2):").grid(row=1, column=0, sticky='w')
        comps_var = tk.IntVar(value=0)
        ttk.Spinbox(f5, from_=0, to=2, textvariable=comps_var, width=4).grid(row=1, column=1, padx=5)
        bonus_label = ttk.Label(f5, text="Bonus XP: 0")
        bonus_label.grid(row=2, column=0, columnspan=2, pady=5)

        def update_bonus(*args):
            b = bonds_var.get() * 2 + comps_var.get() * 2
            if b > 4:
                b = 4
                # clamp
                if bonds_var.get() > 2: bonds_var.set(2)
                if comps_var.get() > 2: comps_var.set(2)
            bonus_label.config(text=f"Bonus XP: +{b} (Total starting XP: {32 + b})")
            temp_data["bonds"] = bonds_var.get()
            temp_data["complications"] = comps_var.get()

        bonds_var.trace('w', update_bonus)
        comps_var.trace('w', update_bonus)
        update_bonus()  # initialise
        pages.append(p5)

        # Page 6: Resources
        p6 = ttk.Frame(wizard)
        ttk.Label(p6, text="Step 6: Starting Resources", font=('Arial', 14, 'bold')).pack(pady=10)
        res_frame = ttk.Frame(p6)
        res_frame.pack(fill='x', padx=20, pady=5)
        res_vars = {}
        res_list = [("Boons", "boons", 0, 5), ("Fatigue", "fatigue", 0, 10), ("Harm", "harm", 0, 3),
                    ("Momentum", "momentum", 0, 2), ("Obligation", "obligation", 0, 20),
                    ("Corruption", "corruption", 0, 10), ("Leash", "leash", 0, 20)]
        for i, (label, key, minv, maxv) in enumerate(res_list):
            ttk.Label(res_frame, text=label + ":").grid(row=i // 2, column=(i % 2) * 2, sticky='w', padx=5)
            var = tk.IntVar(value=0)
            res_vars[key] = var
            ttk.Spinbox(res_frame, from_=minv, to=maxv, textvariable=var, width=4).grid(row=i // 2,
                                                                                         column=(i % 2) * 2 + 1, padx=5)
            temp_data["resources"][key] = 0

            def res_updater(k, v):
                def upd(*args):
                    temp_data["resources"][k] = v.get()
                return upd

            var.trace('w', res_updater(key, var))
        pages.append(p6)

        # Page 7: Assets & Followers
        p7 = ttk.Frame(wizard)
        ttk.Label(p7, text="Step 7: Assets & Followers (optional)", font=('Arial', 14, 'bold')).pack(pady=10)
        asset_listbox = tk.Listbox(p7, height=4)
        asset_listbox.pack(fill='x', padx=20, pady=5)
        asset_entry = ttk.Frame(p7)
        asset_entry.pack(fill='x', padx=20, pady=2)
        ttk.Label(asset_entry, text="Asset Name:").pack(side='left')
        asset_name = tk.StringVar()
        ttk.Entry(asset_entry, textvariable=asset_name, width=15).pack(side='left', padx=2)
        asset_status = tk.StringVar(value="Stable")
        ttk.Combobox(asset_entry, textvariable=asset_status,
                     values=["Flourishing", "Stable", "Strained", "Collapsed"], width=10).pack(side='left', padx=2)

        def add_asset():
            name = asset_name.get().strip()
            if name:
                temp_data["assets"].append({"name": name, "status": asset_status.get()})
                asset_listbox.insert(tk.END, f"{name} ({asset_status.get()})")
                asset_name.set("")

        def remove_asset():
            sel = asset_listbox.curselection()
            if sel:
                idx = sel[0]
                if idx < len(temp_data["assets"]):
                    del temp_data["assets"][idx]
                    asset_listbox.delete(idx)

        ttk.Button(asset_entry, text="Add", command=add_asset).pack(side='left')
        ttk.Button(asset_entry, text="Remove", command=remove_asset).pack(side='left', padx=2)

        fol_listbox = tk.Listbox(p7, height=4)
        fol_listbox.pack(fill='x', padx=20, pady=5)
        fol_entry = ttk.Frame(p7)
        fol_entry.pack(fill='x', padx=20, pady=2)
        ttk.Label(fol_entry, text="Follower Name:").pack(side='left')
        fol_name = tk.StringVar()
        ttk.Entry(fol_entry, textvariable=fol_name, width=12).pack(side='left', padx=2)
        fol_cap = tk.IntVar(value=1)
        ttk.Spinbox(fol_entry, from_=1, to=5, textvariable=fol_cap, width=4).pack(side='left', padx=2)

        def add_fol():
            name = fol_name.get().strip()
            if name:
                temp_data["followers"].append({"name": name, "cap": fol_cap.get(), "loyalty": "Faithful/Ready"})
                fol_listbox.insert(tk.END, f"{name} (Cap {fol_cap.get()})")
                fol_name.set("")

        def remove_fol():
            sel = fol_listbox.curselection()
            if sel:
                idx = sel[0]
                if idx < len(temp_data["followers"]):
                    del temp_data["followers"][idx]
                    fol_listbox.delete(idx)

        ttk.Button(fol_entry, text="Add", command=add_fol).pack(side='left')
        ttk.Button(fol_entry, text="Remove", command=remove_fol).pack(side='left', padx=2)
        pages.append(p7)

        # Page 8: Summary
        p8 = ttk.Frame(wizard)
        ttk.Label(p8, text="Step 8: Summary & Finish", font=('Arial', 14, 'bold')).pack(pady=10)
        summary_text = tk.Text(p8, height=18, width=80)
        summary_text.pack(fill='both', expand=True, padx=20, pady=5)
        summary_text.tag_configure('warning', foreground='red')
        pages.append(p8)

        # ---------- Navigation buttons ----------
        nav_frame = ttk.Frame(wizard)
        nav_frame.pack(fill='x', padx=20, pady=10)
        btn_back = ttk.Button(nav_frame, text="← Back", command=prev_page)
        btn_back.pack(side='left')
        btn_next = ttk.Button(nav_frame, text="Next →", command=next_page)
        btn_next.pack(side='right')

        # Show first page
        current_page = 0
        show_page(0)

    def create_character_tab(self):
        char_frame = ttk.Frame(self.notebook)
        self.notebook.add(char_frame, text="Character")

        top_controls = ttk.Frame(char_frame)
        top_controls.pack(fill='x', padx=10, pady=5)
        ttk.Button(top_controls, text="Character Builder Wizard", command=self.open_builder_wizard).pack(side='left', padx=5)
        ttk.Button(top_controls, text="Refresh Data", command=self.refresh_character_display).pack(side='left', padx=5)

        main_pane = ttk.PanedWindow(char_frame, orient=tk.VERTICAL)
        main_pane.pack(fill='both', expand=True)

        top_frame = ttk.LabelFrame(main_pane, text="Identity")
        main_pane.add(top_frame, weight=1)

        ttk.Label(top_frame, text="Name:").grid(row=0, column=0, sticky='w', padx=5, pady=2)
        self.name_var = tk.StringVar(value=self.player_data["identity"]["name"])
        ttk.Entry(top_frame, textvariable=self.name_var, width=30).grid(row=0, column=1, sticky='ew', padx=5, pady=2)

        ttk.Label(top_frame, text="Heritage:").grid(row=1, column=0, sticky='w', padx=5, pady=2)
        self.heritage_var = tk.StringVar(value=self.player_data["identity"]["heritage"])
        ttk.Entry(top_frame, textvariable=self.heritage_var, width=30).grid(row=1, column=1, sticky='ew', padx=5, pady=2)

        ttk.Label(top_frame, text="Patron:").grid(row=2, column=0, sticky='w', padx=5, pady=2)
        self.patron_var = tk.StringVar(value=self.player_data["identity"]["patron"])
        ttk.Entry(top_frame, textvariable=self.patron_var, width=30).grid(row=2, column=1, sticky='ew', padx=5, pady=2)

        ttk.Label(top_frame, text="Tier:").grid(row=0, column=2, sticky='w', padx=5, pady=2)
        self.tier_var = tk.IntVar(value=self.player_data["identity"]["tier"])
        ttk.Spinbox(top_frame, from_=1, to=5, textvariable=self.tier_var, width=5).grid(row=0, column=3, padx=5, pady=2)

        ttk.Label(top_frame, text="XP:").grid(row=1, column=2, sticky='w', padx=5, pady=2)
        self.xp_var = tk.IntVar(value=self.player_data["identity"]["xp"])
        ttk.Spinbox(top_frame, from_=0, to=9999, textvariable=self.xp_var, width=5).grid(row=1, column=3, padx=5, pady=2)

        top_frame.columnconfigure(1, weight=1)

        middle_pane = ttk.PanedWindow(main_pane, orient=tk.HORIZONTAL)
        main_pane.add(middle_pane, weight=3)

        attr_frame = ttk.LabelFrame(middle_pane, text="Attributes")
        middle_pane.add(attr_frame, weight=1)
        self.attr_vars = {}
        self.attr_cost_vars = {}
        for i, attr in enumerate(["Body", "Wits", "Spirit", "Presence"]):
            key = attr.lower()
            frame = ttk.Frame(attr_frame)
            frame.pack(fill='x', padx=5, pady=2)
            ttk.Label(frame, text=f"{attr}:").pack(side='left')
            var = tk.IntVar(value=self.player_data["attributes"][key])
            self.attr_vars[key] = var
            spin = ttk.Spinbox(frame, from_=1, to=10, textvariable=var, width=4)
            spin.pack(side='left', padx=5)
            ttk.Label(frame, text="Incr. Cost:").pack(side='left')
            cost_var = tk.StringVar(value=str(attr_cost(var.get())))
            self.attr_cost_vars[key] = cost_var
            ttk.Label(frame, textvariable=cost_var, width=6).pack(side='left')
            var.trace('w', lambda *args, k=key: self.update_attr_cost(k))

        skill_frame = ttk.LabelFrame(middle_pane, text="Skills")
        middle_pane.add(skill_frame, weight=2)
        # Reorganize skills into groups
        skill_groups = [
            ("Combat", ["melee", "ranged", "unarmed"]),
            ("Physical", ["athletics", "stealth", "endurance", "craft"]),
            ("Social & Subtle", ["sway", "deception", "subterfuge", "performance", "insight"]),
            ("Knowledge & Magic", ["lore", "investigation", "medicine", "arcana"])
        ]
        self.skill_vars = {}
        self.skill_cost_vars = {}
        for group_name, skills in skill_groups:
            group_frame = ttk.LabelFrame(skill_frame, text=group_name)
            group_frame.pack(side='left', fill='both', expand=True, padx=5, pady=5)
            for skill in skills:
                frame = ttk.Frame(group_frame)
                frame.pack(fill='x', pady=1)
                ttk.Label(frame, text=f"{skill.title()}:", width=14).pack(side='left')
                var = tk.IntVar(value=self.player_data["skills"].get(skill, 0))
                self.skill_vars[skill] = var
                spin = ttk.Spinbox(frame, from_=0, to=5, textvariable=var, width=3)
                spin.pack(side='left')
                ttk.Label(frame, text="Incr. Cost:").pack(side='left')
                cost_var = tk.StringVar(value=str(skill_cost(var.get())))
                self.skill_cost_vars[skill] = cost_var
                ttk.Label(frame, textvariable=cost_var, width=4).pack(side='left')
                var.trace('w', lambda *args, s=skill: self.update_skill_cost(s))

        talent_frame = ttk.LabelFrame(main_pane, text="Talents")
        main_pane.add(talent_frame, weight=1)
        list_frame = ttk.Frame(talent_frame)
        list_frame.pack(fill='both', expand=True, padx=5, pady=5)
        self.talent_listbox = tk.Listbox(list_frame, height=4)
        self.talent_listbox.pack(side='left', fill='both', expand=True)
        scrollbar = ttk.Scrollbar(list_frame, orient='vertical', command=self.talent_listbox.yview)
        scrollbar.pack(side='right', fill='y')
        self.talent_listbox.configure(yscrollcommand=scrollbar.set)

        entry_frame = ttk.Frame(talent_frame)
        entry_frame.pack(fill='x', padx=5, pady=5)

        ttk.Label(entry_frame, text="Library:").pack(side='left')
        talent_names = sorted([t["name"] for t in self.talent_library])
        self.talent_library_var = tk.StringVar()
        talent_combo = ttk.Combobox(entry_frame, textvariable=self.talent_library_var, values=talent_names, width=20)
        talent_combo.pack(side='left', padx=2)

        ttk.Button(entry_frame, text="Add Selected", command=self.add_talent_from_library).pack(side='left', padx=2)

        ttk.Label(entry_frame, text="Name:").pack(side='left', padx=(10,0))
        self.talent_name_var = tk.StringVar()
        ttk.Entry(entry_frame, textvariable=self.talent_name_var, width=12).pack(side='left', padx=2)
        ttk.Label(entry_frame, text="Die Adj:").pack(side='left')
        self.talent_die_var = tk.IntVar(value=0)
        ttk.Spinbox(entry_frame, from_=-5, to=5, textvariable=self.talent_die_var, width=4).pack(side='left', padx=2)
        ttk.Label(entry_frame, text="Condition:").pack(side='left')
        self.talent_condition_var = tk.StringVar()
        ttk.Entry(entry_frame, textvariable=self.talent_condition_var, width=12).pack(side='left', padx=2)
        ttk.Label(entry_frame, text="Cost:").pack(side='left')
        self.talent_cost_var = tk.IntVar(value=2)
        ttk.Spinbox(entry_frame, from_=1, to=15, textvariable=self.talent_cost_var, width=4).pack(side='left', padx=2)

        ttk.Button(entry_frame, text="Add Custom", command=self.add_custom_talent).pack(side='left', padx=2)
        ttk.Button(entry_frame, text="Remove Selected", command=self.remove_talent).pack(side='left')

        bottom_pane = ttk.PanedWindow(main_pane, orient=tk.HORIZONTAL)
        main_pane.add(bottom_pane, weight=2)

        res_frame = ttk.LabelFrame(bottom_pane, text="Resources")
        bottom_pane.add(res_frame, weight=1)
        self.res_vars = {}
        resources = [
            ("Fatigue", "fatigue", 0, 10),
            ("Harm", "harm", 0, 3),
            ("Boons", "boons", 0, 5),
            ("Momentum", "momentum", 0, 2),
            ("Obligation", "obligation", 0, 20),
            ("Corruption", "corruption", 0, 10),
            ("Leash", "leash", 0, 20)
        ]
        for i, (label, key, minv, maxv) in enumerate(resources):
            frame = ttk.Frame(res_frame)
            frame.pack(fill='x', padx=5, pady=2)
            ttk.Label(frame, text=label+":").pack(side='left')
            var = tk.IntVar(value=self.player_data["resources"][key])
            self.res_vars[key] = var
            ttk.Spinbox(frame, from_=minv, to=maxv, textvariable=var, width=5).pack(side='left', padx=5)

        asset_frame = ttk.LabelFrame(bottom_pane, text="Assets")
        bottom_pane.add(asset_frame, weight=1)
        self.asset_listbox = tk.Listbox(asset_frame, height=4)
        self.asset_listbox.pack(side='left', fill='both', expand=True, padx=5, pady=5)
        asset_entry = ttk.Frame(asset_frame)
        asset_entry.pack(fill='x', padx=5, pady=2)
        self.asset_name_var = tk.StringVar()
        ttk.Entry(asset_entry, textvariable=self.asset_name_var, width=12).pack(side='left')
        self.asset_status_var = tk.StringVar(value="Stable")
        ttk.Combobox(asset_entry, textvariable=self.asset_status_var, values=["Flourishing","Stable","Strained","Collapsed"], width=10).pack(side='left', padx=5)
        ttk.Button(asset_entry, text="Add", command=self.add_asset).pack(side='left', padx=2)
        ttk.Button(asset_entry, text="Remove", command=self.remove_asset).pack(side='left')

        follower_frame = ttk.LabelFrame(bottom_pane, text="Followers")
        bottom_pane.add(follower_frame, weight=1)
        self.follower_listbox = tk.Listbox(follower_frame, height=4)
        self.follower_listbox.pack(side='left', fill='both', expand=True, padx=5, pady=5)
        follower_entry = ttk.Frame(follower_frame)
        follower_entry.pack(fill='x', padx=5, pady=2)
        self.follower_name_var = tk.StringVar()
        ttk.Entry(follower_entry, textvariable=self.follower_name_var, width=10).pack(side='left')
        self.follower_cap_var = tk.IntVar(value=1)
        ttk.Spinbox(follower_entry, from_=1, to=5, textvariable=self.follower_cap_var, width=4).pack(side='left', padx=2)
        ttk.Button(follower_entry, text="Add", command=self.add_follower).pack(side='left', padx=2)
        ttk.Button(follower_entry, text="Remove", command=self.remove_follower).pack(side='left')

        debt_frame = ttk.LabelFrame(bottom_pane, text="Debt Timers")
        bottom_pane.add(debt_frame, weight=1)
        self.debt_listbox = tk.Listbox(debt_frame, height=4)
        self.debt_listbox.pack(side='left', fill='both', expand=True, padx=5, pady=5)
        debt_entry = ttk.Frame(debt_frame)
        debt_entry.pack(fill='x', padx=5, pady=2)
        self.debt_name_var = tk.StringVar()
        ttk.Entry(debt_entry, textvariable=self.debt_name_var, width=10).pack(side='left')
        ttk.Button(debt_entry, text="Add", command=self.add_debt).pack(side='left', padx=2)
        ttk.Button(debt_entry, text="Remove", command=self.remove_debt).pack(side='left')
        ttk.Button(debt_entry, text="Tick", command=self.tick_debt).pack(side='left', padx=2)

        extra_frame = ttk.Frame(main_pane)
        main_pane.add(extra_frame, weight=1)
        ttk.Label(extra_frame, text="Bonds (PCs)").grid(row=0, column=0, sticky='w', padx=5)
        self.bonds_text = tk.Text(extra_frame, height=2, width=30)
        self.bonds_text.grid(row=1, column=0, padx=5, sticky='ew')
        self.bonds_text.insert('1.0', self.player_data["bonds"])

        ttk.Label(extra_frame, text="Strings (NPCs)").grid(row=0, column=1, sticky='w', padx=5)
        self.strings_text = tk.Text(extra_frame, height=2, width=30)
        self.strings_text.grid(row=1, column=1, padx=5, sticky='ew')
        self.strings_text.insert('1.0', self.player_data["strings"])

        ttk.Label(extra_frame, text="Personal Notes").grid(row=2, column=0, columnspan=2, sticky='w', padx=5)
        self.notes_text = tk.Text(extra_frame, height=3, width=60)
        self.notes_text.grid(row=3, column=0, columnspan=2, padx=5, sticky='ew')
        self.notes_text.insert('1.0', self.player_data["notes"])

        extra_frame.columnconfigure(0, weight=1)
        extra_frame.columnconfigure(1, weight=1)

        ttk.Button(char_frame, text="Save Character", command=self.save_player_data).pack(pady=5)

    def add_talent_from_library(self):
        selected = self.talent_library_var.get()
        if selected:
            for t in self.talent_library:
                if t["name"] == selected:
                    talent = t.copy()
                    self.player_data["talents"].append(talent)
                    self.refresh_talent_list()
                    break

    def add_custom_talent(self):
        name = self.talent_name_var.get().strip()
        if not name:
            messagebox.showwarning("Missing Name", "Please enter a talent name.")
            return
        talent = {
            "name": name,
            "die_adjustment": self.talent_die_var.get(),
            "condition": self.talent_condition_var.get().strip(),
            "cost": self.talent_cost_var.get()
        }
        self.player_data["talents"].append(talent)
        self.talent_name_var.set("")
        self.talent_die_var.set(0)
        self.talent_condition_var.set("")
        self.talent_cost_var.set(2)
        self.refresh_talent_list()

    def remove_talent(self):
        sel = self.talent_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.player_data["talents"]):
                del self.player_data["talents"][idx]
                self.refresh_talent_list()

    def refresh_talent_list(self):
        self.talent_listbox.delete(0, tk.END)
        for t in self.player_data["talents"]:
            desc = f"{t['name']} (adj {t['die_adjustment']:+d})"
            if t.get('condition'):
                desc += f" [{t['condition']}]"
            self.talent_listbox.insert(tk.END, desc)

    def update_attr_cost(self, key):
        val = self.attr_vars[key].get()
        self.attr_cost_vars[key].set(str(attr_cost(val)))

    def update_skill_cost(self, key):
        val = self.skill_vars[key].get()
        self.skill_cost_vars[key].set(str(skill_cost(val)))

    def add_asset(self):
        name = self.asset_name_var.get().strip()
        if name:
            self.player_data["assets"].append({"name": name, "status": self.asset_status_var.get()})
            self.asset_name_var.set("")
            self.refresh_asset_list()

    def remove_asset(self):
        sel = self.asset_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.player_data["assets"]):
                del self.player_data["assets"][idx]
                self.refresh_asset_list()

    def refresh_asset_list(self):
        self.asset_listbox.delete(0, tk.END)
        for a in self.player_data["assets"]:
            self.asset_listbox.insert(tk.END, f"{a['name']} ({a['status']})")

    def add_follower(self):
        name = self.follower_name_var.get().strip()
        if name:
            cap = self.follower_cap_var.get()
            self.player_data["followers"].append({"name": name, "cap": cap, "loyalty": "Faithful/Ready"})
            self.follower_name_var.set("")
            self.refresh_follower_list()

    def remove_follower(self):
        sel = self.follower_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.player_data["followers"]):
                del self.player_data["followers"][idx]
                self.refresh_follower_list()

    def refresh_follower_list(self):
        self.follower_listbox.delete(0, tk.END)
        for f in self.player_data["followers"]:
            self.follower_listbox.insert(tk.END, f"{f['name']} (Cap {f['cap']})")

    def add_debt(self):
        name = self.debt_name_var.get().strip()
        if name:
            self.player_data["debt_timers"].append({"name": name, "segments": 0})
            self.debt_name_var.set("")
            self.refresh_debt_list()

    def remove_debt(self):
        sel = self.debt_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.player_data["debt_timers"]):
                del self.player_data["debt_timers"][idx]
                self.refresh_debt_list()

    def tick_debt(self):
        sel = self.debt_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.player_data["debt_timers"]):
                self.player_data["debt_timers"][idx]["segments"] += 1
                self.refresh_debt_list()

    def refresh_debt_list(self):
        self.debt_listbox.delete(0, tk.END)
        for d in self.player_data["debt_timers"]:
            self.debt_listbox.insert(tk.END, f"{d['name']} ({d['segments']})")

    def refresh_character_display(self):
        self.name_var.set(self.player_data["identity"]["name"])
        self.heritage_var.set(self.player_data["identity"]["heritage"])
        self.patron_var.set(self.player_data["identity"]["patron"])
        self.tier_var.set(self.player_data["identity"]["tier"])
        self.xp_var.set(self.player_data["identity"]["xp"])
        for attr in self.attr_vars:
            self.attr_vars[attr].set(self.player_data["attributes"][attr])
            self.update_attr_cost(attr)
        for skill in self.skill_vars:
            self.skill_vars[skill].set(self.player_data["skills"][skill])
            self.update_skill_cost(skill)
        for res in self.res_vars:
            self.res_vars[res].set(self.player_data["resources"][res])
        self.refresh_talent_list()
        self.refresh_asset_list()
        self.refresh_follower_list()
        self.refresh_debt_list()
        self.bonds_text.delete('1.0', tk.END)
        self.bonds_text.insert('1.0', self.player_data["bonds"])
        self.strings_text.delete('1.0', tk.END)
        self.strings_text.insert('1.0', self.player_data["strings"])
        self.notes_text.delete('1.0', tk.END)
        self.notes_text.insert('1.0', self.player_data["notes"])

    # -------------------------------
    # Dice Tab
    # -------------------------------
    def create_dice_tab(self):
        dice_frame = ttk.Frame(self.notebook)
        self.notebook.add(dice_frame, text="Dice Roller")

        pool_frame = ttk.LabelFrame(dice_frame, text="Dice Pool")
        pool_frame.pack(fill='x', padx=10, pady=5)

        self.dice_attr_vars = {}
        attrs = ["Body", "Wits", "Spirit", "Presence"]
        for i, attr in enumerate(attrs):
            key = attr.lower()
            frame = ttk.Frame(pool_frame)
            frame.grid(row=0, column=i, padx=5, pady=2)
            ttk.Label(frame, text=f"{attr}:").pack(side='left')
            var = tk.IntVar(value=self.player_data["attributes"][key])
            self.dice_attr_vars[key] = var
            ttk.Spinbox(frame, from_=0, to=10, textvariable=var, width=3).pack(side='left')

        skill_pool_frame = ttk.Frame(pool_frame)
        skill_pool_frame.grid(row=1, column=0, columnspan=4, sticky='ew', padx=5, pady=2)
        canvas = tk.Canvas(skill_pool_frame, height=80)
        scrollbar = ttk.Scrollbar(skill_pool_frame, orient='vertical', command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        scrollable_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=scrollable_frame, anchor='nw')
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')

        self.dice_skill_vars = {}
        # Core 16 skills
        skill_list = list(DEFAULT_PLAYER_DATA["skills"].keys())
        for idx, skill in enumerate(skill_list):
            frame = ttk.Frame(scrollable_frame)
            frame.grid(row=idx//6, column=idx%6, padx=2, pady=1)
            ttk.Label(frame, text=f"{skill.title()[:4]}:").pack(side='left')
            var = tk.IntVar(value=self.player_data["skills"][skill])
            self.dice_skill_vars[skill] = var
            ttk.Spinbox(frame, from_=0, to=5, textvariable=var, width=3).pack(side='left')

        total_frame = ttk.Frame(pool_frame)
        total_frame.grid(row=2, column=0, columnspan=4, pady=5)
        ttk.Label(total_frame, text="Total Dice:").pack(side='left')
        self.dice_total_label = ttk.Label(total_frame, text="0", font=('Arial', 12, 'bold'))
        self.dice_total_label.pack(side='left', padx=5)
        for var in list(self.dice_attr_vars.values()) + list(self.dice_skill_vars.values()):
            var.trace('w', self.update_dice_total)

        settings_frame = ttk.LabelFrame(dice_frame, text="Roll Settings")
        settings_frame.pack(fill='x', padx=10, pady=5)

        ttk.Label(settings_frame, text="DV:").pack(side='left', padx=5)
        self.dice_dv_var = tk.IntVar(value=3)
        ttk.Spinbox(settings_frame, from_=2, to=6, textvariable=self.dice_dv_var, width=3).pack(side='left')

        ttk.Label(settings_frame, text="Position:").pack(side='left', padx=5)
        self.dice_position_var = tk.StringVar(value="Controlled")
        ttk.Combobox(settings_frame, textvariable=self.dice_position_var,
                     values=["Dominant", "Controlled", "Desperate"], width=10).pack(side='left')

        ttk.Label(settings_frame, text="Effect:").pack(side='left', padx=5)
        self.dice_effect_var = tk.StringVar(value="Standard")
        ttk.Combobox(settings_frame, textvariable=self.dice_effect_var,
                     values=["Limited", "Standard", "Great"], width=10).pack(side='left')

        ttk.Button(settings_frame, text="Roll", command=self.do_roll).pack(side='left', padx=20)

        armor_frame = ttk.LabelFrame(dice_frame, text="Armor Conversion")
        armor_frame.pack(fill='x', padx=10, pady=5)

        ttk.Label(armor_frame, text="Incoming Harm:").pack(side='left', padx=5)
        self.armor_harm_var = tk.IntVar(value=1)
        ttk.Spinbox(armor_frame, from_=1, to=5, textvariable=self.armor_harm_var, width=3).pack(side='left')

        ttk.Label(armor_frame, text="Armor Type:").pack(side='left', padx=5)
        self.armor_type_var = tk.StringVar(value="Light")
        ttk.Combobox(armor_frame, textvariable=self.armor_type_var,
                     values=["Light", "Medium", "Heavy", "Superior", "Mythic"], width=10).pack(side='left')

        ttk.Button(armor_frame, text="Convert", command=self.do_armor_convert).pack(side='left', padx=5)
        self.armor_result_label = ttk.Label(armor_frame, text="")
        self.armor_result_label.pack(side='left', padx=10)

        result_frame = ttk.LabelFrame(dice_frame, text="Roll Result")
        result_frame.pack(fill='both', expand=True, padx=10, pady=5)

        self.dice_result_text = tk.Text(result_frame, height=10, width=80)
        self.dice_result_text.pack(fill='both', expand=True, padx=5, pady=5)

        self.update_dice_total()

    def update_dice_total(self, *args):
        total = 0
        for var in self.dice_attr_vars.values():
            total += var.get()
        for var in self.dice_skill_vars.values():
            total += var.get()
        self.dice_total_label.config(text=str(total))

    def do_roll(self):
        pool = 0
        for var in self.dice_attr_vars.values():
            pool += var.get()
        for var in self.dice_skill_vars.values():
            pool += var.get()
        if pool == 0:
            messagebox.showwarning("No Dice", "Dice pool is zero!")
            return

        dice = [random.randint(1, 10) for _ in range(pool)]
        successes = sum(1 for d in dice if d >= 6)
        crits = sum(1 for d in dice if d == 10)
        successes += crits
        story_beats = sum(1 for d in dice if d == 1)

        dv = self.dice_dv_var.get()
        position = self.dice_position_var.get()

        if successes >= dv:
            if story_beats == 0:
                outcome = "Clean Success"
            else:
                outcome = "Success with SB"
        elif successes > 0:
            outcome = "Partial"
        else:
            outcome = "Miss"

        pos_effect = {
            "Dominant": "Re-roll one failure",
            "Controlled": "No re-rolls",
            "Desperate": "Re-roll one success"
        }.get(position, "")

        resource_effects = []
        if outcome == "Partial":
            resource_effects.append("Gain 1 Boon")
        elif outcome == "Miss":
            resource_effects.append("Gain 2 Boons")
        if story_beats > 0:
            resource_effects.append(f"GM gains {story_beats} SB")

        result = f"Rolled {pool}d10: {dice}\n"
        result += f"Successes: {successes} (including {crits} criticals)\n"
        result += f"Story Beats: {story_beats}\n"
        result += f"DV: {dv}  Position: {position}  Effect: {self.dice_effect_var.get()}\n"
        result += f"Outcome: {outcome}\n"
        result += f"Position Effect: {pos_effect}\n"
        result += f"Resource Effects: {', '.join(resource_effects) if resource_effects else 'None'}"

        self.dice_result_text.delete('1.0', tk.END)
        self.dice_result_text.insert('1.0', result)

        self.roll_history.append({
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "character": self.player_data["identity"]["name"] or "Unnamed",
            "pool": pool,
            "dice": dice,
            "successes": successes,
            "story_beats": story_beats,
            "dv": dv,
            "outcome": outcome,
            "position": position
        })
        self.update_history_display()

    def do_armor_convert(self):
        harm_in = self.armor_harm_var.get()
        armor = self.armor_type_var.get()
        fatigue, harm_rem = armor_conversion(harm_in, armor)
        self.armor_result_label.config(text=f"Fatigue {fatigue}, Harm {harm_rem}")

    # -------------------------------
    # GM Tab
    # -------------------------------
    def create_gm_tab(self):
        gm_frame = ttk.Frame(self.notebook)
        self.notebook.add(gm_frame, text="GM Tools")

        main_pane = ttk.PanedWindow(gm_frame, orient=tk.VERTICAL)
        main_pane.pack(fill='both', expand=True)

        top_frame = ttk.LabelFrame(main_pane, text="Campaign")
        main_pane.add(top_frame, weight=1)

        ttk.Label(top_frame, text="Name:").grid(row=0, column=0, sticky='w', padx=5)
        self.gm_camp_name = tk.StringVar(value=self.gm_data["campaign"]["name"])
        ttk.Entry(top_frame, textvariable=self.gm_camp_name, width=30).grid(row=0, column=1, sticky='ew', padx=5)

        ttk.Label(top_frame, text="Session:").grid(row=0, column=2, sticky='w', padx=5)
        self.gm_session = tk.IntVar(value=self.gm_data["campaign"]["session"])
        ttk.Spinbox(top_frame, from_=1, to=999, textvariable=self.gm_session, width=6).grid(row=0, column=3, padx=5)

        ttk.Label(top_frame, text="Last Session:").grid(row=1, column=0, sticky='w', padx=5)
        self.gm_last_session = tk.StringVar(value=self.gm_data["campaign"]["last_session"])
        ttk.Entry(top_frame, textvariable=self.gm_last_session, width=30).grid(row=1, column=1, sticky='ew', padx=5)

        ttk.Label(top_frame, text="Mandate:").grid(row=0, column=4, sticky='w', padx=5)
        self.gm_mandate = tk.IntVar(value=self.gm_data["campaign"]["mandate"])
        ttk.Spinbox(top_frame, from_=0, to=6, textvariable=self.gm_mandate, width=4).grid(row=0, column=5, padx=5)

        ttk.Label(top_frame, text="Crisis:").grid(row=1, column=4, sticky='w', padx=5)
        self.gm_crisis = tk.IntVar(value=self.gm_data["campaign"]["crisis"])
        ttk.Spinbox(top_frame, from_=0, to=6, textvariable=self.gm_crisis, width=4).grid(row=1, column=5, padx=5)

        top_frame.columnconfigure(1, weight=1)

        actions = ttk.Frame(top_frame)
        actions.grid(row=2, column=0, columnspan=6, pady=5)
        ttk.Button(actions, text="New Session", command=self.gm_new_session).pack(side='left', padx=5)
        ttk.Button(actions, text="End Session", command=self.gm_end_session).pack(side='left', padx=5)
        ttk.Button(actions, text="Advance Clocks", command=self.gm_advance_clocks).pack(side='left', padx=5)
        ttk.Button(actions, text="Faction Turns", command=self.gm_faction_turns).pack(side='left', padx=5)

        mid_pane = ttk.PanedWindow(main_pane, orient=tk.HORIZONTAL)
        main_pane.add(mid_pane, weight=3)

        clock_frame = ttk.LabelFrame(mid_pane, text="Clocks")
        mid_pane.add(clock_frame, weight=1)
        self.clock_listbox = tk.Listbox(clock_frame, height=8)
        self.clock_listbox.pack(side='left', fill='both', expand=True, padx=5, pady=5)
        scroll = ttk.Scrollbar(clock_frame, orient='vertical', command=self.clock_listbox.yview)
        scroll.pack(side='right', fill='y')
        self.clock_listbox.configure(yscrollcommand=scroll.set)

        clock_entry = ttk.Frame(clock_frame)
        clock_entry.pack(fill='x', padx=5, pady=2)
        self.clock_name_var = tk.StringVar()
        ttk.Entry(clock_entry, textvariable=self.clock_name_var, width=10).pack(side='left')
        self.clock_seg_var = tk.IntVar(value=6)
        ttk.Spinbox(clock_entry, from_=1, to=20, textvariable=self.clock_seg_var, width=4).pack(side='left')
        ttk.Button(clock_entry, text="Add", command=self.gm_add_clock).pack(side='left', padx=2)
        ttk.Button(clock_entry, text="Remove", command=self.gm_remove_clock).pack(side='left')
        ttk.Button(clock_entry, text="Tick", command=self.gm_tick_clock).pack(side='left', padx=2)
        ttk.Button(clock_entry, text="Reset", command=self.gm_reset_clock).pack(side='left')

        faction_frame = ttk.LabelFrame(mid_pane, text="Factions")
        mid_pane.add(faction_frame, weight=1)
        self.faction_listbox = tk.Listbox(faction_frame, height=8)
        self.faction_listbox.pack(side='left', fill='both', expand=True, padx=5, pady=5)
        scroll2 = ttk.Scrollbar(faction_frame, orient='vertical', command=self.faction_listbox.yview)
        scroll2.pack(side='right', fill='y')
        self.faction_listbox.configure(yscrollcommand=scroll2.set)

        faction_entry = ttk.Frame(faction_frame)
        faction_entry.pack(fill='x', padx=5, pady=2)
        self.faction_name_var = tk.StringVar()
        ttk.Entry(faction_entry, textvariable=self.faction_name_var, width=10).pack(side='left')
        self.faction_agenda_var = tk.StringVar()
        ttk.Entry(faction_entry, textvariable=self.faction_agenda_var, width=10).pack(side='left', padx=2)
        ttk.Button(faction_entry, text="Add", command=self.gm_add_faction).pack(side='left', padx=2)
        ttk.Button(faction_entry, text="Remove", command=self.gm_remove_faction).pack(side='left')
        ttk.Button(faction_entry, text="Turn", command=self.gm_faction_turn).pack(side='left', padx=2)

        patron_frame = ttk.LabelFrame(mid_pane, text="Patrons")
        mid_pane.add(patron_frame, weight=1)
        self.patron_listbox = tk.Listbox(patron_frame, height=8)
        self.patron_listbox.pack(side='left', fill='both', expand=True, padx=5, pady=5)
        scroll3 = ttk.Scrollbar(patron_frame, orient='vertical', command=self.patron_listbox.yview)
        scroll3.pack(side='right', fill='y')
        self.patron_listbox.configure(yscrollcommand=scroll3.set)

        patron_entry = ttk.Frame(patron_frame)
        patron_entry.pack(fill='x', padx=5, pady=2)
        self.patron_name_var = tk.StringVar()
        ttk.Entry(patron_entry, textvariable=self.patron_name_var, width=10).pack(side='left')
        self.patron_type_var = tk.StringVar(value="Cosmic")
        ttk.Combobox(patron_entry, textvariable=self.patron_type_var, values=["Cosmic","Terrestrial"], width=10).pack(side='left', padx=2)
        ttk.Button(patron_entry, text="Add", command=self.gm_add_patron).pack(side='left', padx=2)
        ttk.Button(patron_entry, text="Remove", command=self.gm_remove_patron).pack(side='left')
        ttk.Button(patron_entry, text="Intrusion", command=self.gm_patron_intrusion).pack(side='left', padx=2)

        bottom_pane = ttk.PanedWindow(main_pane, orient=tk.HORIZONTAL)
        main_pane.add(bottom_pane, weight=2)

        trust_frame = ttk.LabelFrame(bottom_pane, text="Player Trust")
        bottom_pane.add(trust_frame, weight=1)
        ttk.Label(trust_frame, text="Name:").grid(row=0, column=0, sticky='w', padx=5)
        self.trust_name = tk.StringVar(value=self.gm_data["trust"]["name"])
        ttk.Entry(trust_frame, textvariable=self.trust_name, width=15).grid(row=0, column=1, padx=5)
        ttk.Label(trust_frame, text="Tier:").grid(row=0, column=2, sticky='w', padx=5)
        self.trust_tier = tk.IntVar(value=self.gm_data["trust"]["tier"])
        ttk.Spinbox(trust_frame, from_=1, to=3, textvariable=self.trust_tier, width=4).grid(row=0, column=3, padx=5)
        ttk.Label(trust_frame, text="XP:").grid(row=0, column=4, sticky='w', padx=5)
        self.trust_xp = tk.IntVar(value=self.gm_data["trust"]["xp"])
        ttk.Spinbox(trust_frame, from_=0, to=999, textvariable=self.trust_xp, width=6).grid(row=0, column=5, padx=5)
        ttk.Button(trust_frame, text="Update", command=self.gm_update_trust).grid(row=0, column=6, padx=5)

        ttk.Label(trust_frame, text="Assets:").grid(row=1, column=0, sticky='w', padx=5)
        self.trust_asset_listbox = tk.Listbox(trust_frame, height=3)
        self.trust_asset_listbox.grid(row=1, column=1, columnspan=2, sticky='ew', padx=5)
        asset_entry = ttk.Frame(trust_frame)
        asset_entry.grid(row=2, column=0, columnspan=3, sticky='ew', padx=5)
        self.trust_asset_name = tk.StringVar()
        ttk.Entry(asset_entry, textvariable=self.trust_asset_name, width=12).pack(side='left')
        self.trust_asset_type = tk.StringVar(value="Minor")
        ttk.Combobox(asset_entry, textvariable=self.trust_asset_type, values=["Minor","Standard","Major"], width=8).pack(side='left', padx=2)
        ttk.Button(asset_entry, text="Add", command=self.gm_add_trust_asset).pack(side='left')
        ttk.Button(asset_entry, text="Remove", command=self.gm_remove_trust_asset).pack(side='left', padx=2)

        ttk.Label(trust_frame, text="Followers:").grid(row=1, column=3, sticky='w', padx=5)
        self.trust_follower_listbox = tk.Listbox(trust_frame, height=3)
        self.trust_follower_listbox.grid(row=1, column=4, columnspan=2, sticky='ew', padx=5)
        follower_entry = ttk.Frame(trust_frame)
        follower_entry.grid(row=2, column=3, columnspan=3, sticky='ew', padx=5)
        self.trust_follower_name = tk.StringVar()
        ttk.Entry(follower_entry, textvariable=self.trust_follower_name, width=10).pack(side='left')
        self.trust_follower_cap = tk.IntVar(value=3)
        ttk.Spinbox(follower_entry, from_=1, to=5, textvariable=self.trust_follower_cap, width=4).pack(side='left', padx=2)
        ttk.Button(follower_entry, text="Add", command=self.gm_add_trust_follower).pack(side='left')
        ttk.Button(follower_entry, text="Remove", command=self.gm_remove_trust_follower).pack(side='left', padx=2)

        rival_frame = ttk.LabelFrame(bottom_pane, text="Rivals")
        bottom_pane.add(rival_frame, weight=1)
        self.rival_listbox = tk.Listbox(rival_frame, height=6)
        self.rival_listbox.pack(side='left', fill='both', expand=True, padx=5, pady=5)
        scroll4 = ttk.Scrollbar(rival_frame, orient='vertical', command=self.rival_listbox.yview)
        scroll4.pack(side='right', fill='y')
        self.rival_listbox.configure(yscrollcommand=scroll4.set)

        rival_entry = ttk.Frame(rival_frame)
        rival_entry.pack(fill='x', padx=5, pady=2)
        self.rival_name_var = tk.StringVar()
        ttk.Entry(rival_entry, textvariable=self.rival_name_var, width=12).pack(side='left')
        ttk.Button(rival_entry, text="Add", command=self.gm_add_rival).pack(side='left', padx=2)
        ttk.Button(rival_entry, text="Remove", command=self.gm_remove_rival).pack(side='left')
        ttk.Button(rival_entry, text="Advance", command=self.gm_advance_rival).pack(side='left', padx=2)

        deck_frame = ttk.LabelFrame(bottom_pane, text="Deck of Consequences")
        bottom_pane.add(deck_frame, weight=1)

        control_frame = ttk.Frame(deck_frame)
        control_frame.pack(fill='x', padx=5, pady=5)

        ttk.Label(control_frame, text="Draw:").pack(side='left')
        self.deck_count_var = tk.IntVar(value=1)
        ttk.Spinbox(control_frame, from_=1, to=3, textvariable=self.deck_count_var, width=4).pack(side='left', padx=5)
        ttk.Button(control_frame, text="Draw Cards", command=self.draw_deck_cards).pack(side='left', padx=5)
        ttk.Button(control_frame, text="Clear", command=self.clear_deck_display).pack(side='left', padx=5)

        self.deck_display_text = tk.Text(deck_frame, height=6, width=30, font=('Courier', 9))
        self.deck_display_text.pack(fill='both', expand=True, padx=5, pady=5)

        synth_frame = ttk.Frame(deck_frame)
        synth_frame.pack(fill='x', padx=5, pady=5)
        ttk.Label(synth_frame, text="Synthesis:").pack(side='left')
        self.deck_synthesis_var = tk.StringVar()
        ttk.Entry(synth_frame, textvariable=self.deck_synthesis_var, width=30).pack(side='left', padx=5)
        ttk.Button(synth_frame, text="Apply Twist", command=self.apply_deck_twist).pack(side='left', padx=5)

        ref_frame = ttk.LabelFrame(deck_frame, text="Quick Reference")
        ref_frame.pack(fill='x', padx=5, pady=5)
        ref_text = tk.Text(ref_frame, height=5, width=30, font=('Courier', 8))
        ref_text.pack(fill='x', padx=2, pady=2)
        ref_text.insert('1.0',
            "Hearts: Low=Social awkwardness, High=Betrayal\n"
            "Spades: Low=Bruise/gear damage, High=Injury/collapse\n"
            "Clubs: Low=Minor resource loss, High=Asset destroyed/debt\n"
            "Diamonds: Low=Omen/curse, High=Patron demand/reality bend\n"
        )
        ref_text.config(state='disabled')

        notes_frame = ttk.LabelFrame(bottom_pane, text="GM Notes")
        bottom_pane.add(notes_frame, weight=2)
        self.gm_notes_text = tk.Text(notes_frame, height=8)
        self.gm_notes_text.pack(fill='both', expand=True, padx=5, pady=5)
        self.gm_notes_text.insert('1.0', self.gm_data["notes"])

        ttk.Button(gm_frame, text="Save GM Data", command=self.save_gm_data).pack(pady=5)

    def draw_deck_cards(self):
        count = self.deck_count_var.get()
        if count < 1 or count > 3:
            messagebox.showwarning("Invalid Count", "Draw 1-3 cards.")
            return

        suits = ['Hearts', 'Spades', 'Clubs', 'Diamonds']
        ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        severity = {
            'A': 'Minor', '2': 'Minor', '3': 'Minor',
            '4': 'Moderate', '5': 'Moderate', '6': 'Moderate',
            '7': 'Significant', '8': 'Significant', '9': 'Significant',
            '10': 'Major', 'J': 'Major', 'Q': 'Major', 'K': 'Major'
        }
        drawn = []
        for _ in range(count):
            suit = random.choice(suits)
            rank = random.choice(ranks)
            drawn.append((suit, rank))

        display = "Drawn Cards:\n"
        for i, (suit, rank) in enumerate(drawn, 1):
            emoji = {'Hearts':'♥', 'Spades':'♠', 'Clubs':'♣', 'Diamonds':'♦'}.get(suit, '')
            display += f"  {i}. {rank}{emoji} ({suit}) - {severity[rank]}\n"
        display += "\nSuit meanings:\n"
        display += "♥ Social/Emotional   ♠ Physical/Harm\n"
        display += "♣ Resource/Cost      ♦ Magical/Spiritual\n"

        self.deck_display_text.delete('1.0', tk.END)
        self.deck_display_text.insert('1.0', display)

        self.last_drawn_cards = drawn
        self.deck_synthesis_var.set("")

    def clear_deck_display(self):
        self.deck_display_text.delete('1.0', tk.END)
        self.deck_synthesis_var.set("")
        self.last_drawn_cards = []

    def apply_deck_twist(self):
        twist = self.deck_synthesis_var.get().strip()
        if not twist:
            messagebox.showinfo("No Twist", "Enter a synthesis before applying.")
            return
        messagebox.showinfo("Twist Applied", f"Twist: {twist}\n\nUse this to complicate the scene!")

    # -------------------------------
    # GM Methods
    # -------------------------------
    def gm_new_session(self):
        self.gm_session.set(self.gm_session.get() + 1)
        self.gm_last_session.set(datetime.now().strftime("%Y-%m-%d"))
        self.gm_update_campaign()

    def gm_end_session(self):
        for clock in self.gm_data["clocks"]:
            if clock["current"] < clock["segments"]:
                clock["current"] += 1
        self.save_gm_data()
        self.refresh_gm_display()
        messagebox.showinfo("Session", "Session ended. Clocks advanced.")

    def gm_advance_clocks(self):
        count = 0
        for clock in self.gm_data["clocks"]:
            if clock["current"] < clock["segments"]:
                clock["current"] += 1
                count += 1
        self.save_gm_data()
        self.refresh_gm_display()
        messagebox.showinfo("Clocks", f"Advanced {count} clocks.")

    def gm_faction_turns(self):
        for faction in self.gm_data["factions"]:
            roll = random.randint(1, 6)
            if roll <= 2:
                faction["agenda_progress"] = max(0, faction.get("agenda_progress", 0) - 1)
            elif roll <= 5:
                pass
            else:
                faction["agenda_progress"] = faction.get("agenda_progress", 0) + 1
        self.save_gm_data()
        self.refresh_gm_display()
        messagebox.showinfo("Faction Turns", "Faction agendas advanced.")

    def gm_add_clock(self):
        name = self.clock_name_var.get().strip()
        if name:
            seg = self.clock_seg_var.get()
            self.gm_data["clocks"].append({"name": name, "segments": seg, "current": 0})
            self.clock_name_var.set("")
            self.refresh_gm_display()

    def gm_remove_clock(self):
        sel = self.clock_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.gm_data["clocks"]):
                del self.gm_data["clocks"][idx]
                self.refresh_gm_display()

    def gm_tick_clock(self):
        sel = self.clock_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.gm_data["clocks"]):
                clock = self.gm_data["clocks"][idx]
                if clock["current"] < clock["segments"]:
                    clock["current"] += 1
                    self.save_gm_data()
                    self.refresh_gm_display()

    def gm_reset_clock(self):
        sel = self.clock_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.gm_data["clocks"]):
                self.gm_data["clocks"][idx]["current"] = 0
                self.save_gm_data()
                self.refresh_gm_display()

    def gm_add_faction(self):
        name = self.faction_name_var.get().strip()
        if name:
            self.gm_data["factions"].append({
                "name": name,
                "agenda": self.faction_agenda_var.get(),
                "agenda_progress": 0
            })
            self.faction_name_var.set("")
            self.faction_agenda_var.set("")
            self.refresh_gm_display()

    def gm_remove_faction(self):
        sel = self.faction_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.gm_data["factions"]):
                del self.gm_data["factions"][idx]
                self.refresh_gm_display()

    def gm_faction_turn(self):
        sel = self.faction_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.gm_data["factions"]):
                faction = self.gm_data["factions"][idx]
                roll = random.randint(1, 6)
                if roll <= 2:
                    faction["agenda_progress"] = max(0, faction.get("agenda_progress", 0) - 1)
                    result = "Setback"
                elif roll <= 5:
                    result = "Stalled"
                else:
                    faction["agenda_progress"] = faction.get("agenda_progress", 0) + 1
                    result = "Advance"
                self.save_gm_data()
                self.refresh_gm_display()
                messagebox.showinfo("Faction Turn", f"{faction['name']}: {result}")

    def gm_add_patron(self):
        name = self.patron_name_var.get().strip()
        if name:
            self.gm_data["patrons"].append({
                "name": name,
                "type": self.patron_type_var.get(),
                "obligation": 0,
                "interest": 0,
                "last_intrusion": ""
            })
            self.patron_name_var.set("")
            self.refresh_gm_display()

    def gm_remove_patron(self):
        sel = self.patron_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.gm_data["patrons"]):
                del self.gm_data["patrons"][idx]
                self.refresh_gm_display()

    def gm_patron_intrusion(self):
        sel = self.patron_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.gm_data["patrons"]):
                patron = self.gm_data["patrons"][idx]
                intrusions = ["Demands a quest", "Impose a cost", "Send an omen", "Summon rival servant"]
                intrusion = random.choice(intrusions)
                patron["last_intrusion"] = intrusion
                patron["interest"] += 1
                self.save_gm_data()
                self.refresh_gm_display()
                messagebox.showinfo("Patron Intrusion", f"{patron['name']}: {intrusion}")

    def gm_update_trust(self):
        self.gm_data["trust"]["name"] = self.trust_name.get()
        self.gm_data["trust"]["tier"] = self.trust_tier.get()
        self.gm_data["trust"]["xp"] = self.trust_xp.get()
        self.save_gm_data()
        messagebox.showinfo("Trust", "Trust updated.")

    def gm_add_trust_asset(self):
        name = self.trust_asset_name.get().strip()
        if name:
            self.gm_data["trust"]["assets"].append({
                "name": name,
                "type": self.trust_asset_type.get(),
                "status": "Stable"
            })
            self.trust_asset_name.set("")
            self.refresh_gm_display()

    def gm_remove_trust_asset(self):
        sel = self.trust_asset_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.gm_data["trust"]["assets"]):
                del self.gm_data["trust"]["assets"][idx]
                self.refresh_gm_display()

    def gm_add_trust_follower(self):
        name = self.trust_follower_name.get().strip()
        if name:
            cap = self.trust_follower_cap.get()
            self.gm_data["trust"]["followers"].append({
                "name": name,
                "cap": cap,
                "loyalty": "Faithful/Ready"
            })
            self.trust_follower_name.set("")
            self.refresh_gm_display()

    def gm_remove_trust_follower(self):
        sel = self.trust_follower_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.gm_data["trust"]["followers"]):
                del self.gm_data["trust"]["followers"][idx]
                self.refresh_gm_display()

    def gm_add_rival(self):
        name = self.rival_name_var.get().strip()
        if name:
            self.gm_data["rivals"].append({"name": name, "agenda": 0})
            self.rival_name_var.set("")
            self.refresh_gm_display()

    def gm_remove_rival(self):
        sel = self.rival_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.gm_data["rivals"]):
                del self.gm_data["rivals"][idx]
                self.refresh_gm_display()

    def gm_advance_rival(self):
        sel = self.rival_listbox.curselection()
        if sel:
            idx = sel[0]
            if idx < len(self.gm_data["rivals"]):
                self.gm_data["rivals"][idx]["agenda"] += 1
                self.save_gm_data()
                self.refresh_gm_display()

    def gm_update_campaign(self):
        self.gm_data["campaign"]["name"] = self.gm_camp_name.get()
        self.gm_data["campaign"]["session"] = self.gm_session.get()
        self.gm_data["campaign"]["last_session"] = self.gm_last_session.get()
        self.gm_data["campaign"]["mandate"] = self.gm_mandate.get()
        self.gm_data["campaign"]["crisis"] = self.gm_crisis.get()
        self.save_gm_data()
        messagebox.showinfo("Campaign", "Campaign info updated.")

    def refresh_gm_display(self):
        self.clock_listbox.delete(0, tk.END)
        for clock in self.gm_data["clocks"]:
            status = f"{clock['current']}/{clock['segments']}"
            if clock['current'] >= clock['segments']:
                status += " (FULL)"
            self.clock_listbox.insert(tk.END, f"{clock['name']}: {status}")

        self.faction_listbox.delete(0, tk.END)
        for faction in self.gm_data["factions"]:
            prog = faction.get("agenda_progress", 0)
            self.faction_listbox.insert(tk.END, f"{faction['name']}: {faction.get('agenda','')} ({prog})")

        self.patron_listbox.delete(0, tk.END)
        for patron in self.gm_data["patrons"]:
            self.patron_listbox.insert(tk.END, f"{patron['name']} ({patron['type']})")

        self.rival_listbox.delete(0, tk.END)
        for rival in self.gm_data["rivals"]:
            self.rival_listbox.insert(tk.END, f"{rival['name']} (Agenda {rival['agenda']})")

        self.trust_asset_listbox.delete(0, tk.END)
        for asset in self.gm_data["trust"]["assets"]:
            self.trust_asset_listbox.insert(tk.END, f"{asset['name']} ({asset['type']})")
        self.trust_follower_listbox.delete(0, tk.END)
        for fol in self.gm_data["trust"]["followers"]:
            self.trust_follower_listbox.insert(tk.END, f"{fol['name']} (Cap {fol['cap']})")

        self.gm_notes_text.delete('1.0', tk.END)
        self.gm_notes_text.insert('1.0', self.gm_data["notes"])

    # -------------------------------
    # History Tab
    # -------------------------------
    def create_history_tab(self):
        hist_frame = ttk.Frame(self.notebook)
        self.notebook.add(hist_frame, text="History")

        controls = ttk.Frame(hist_frame)
        controls.pack(fill='x', padx=10, pady=5)
        ttk.Button(controls, text="Clear History", command=self.clear_history).pack(side='right')

        self.history_listbox = tk.Listbox(hist_frame, font=('Courier', 9))
        self.history_listbox.pack(fill='both', expand=True, padx=10, pady=5)
        scroll = ttk.Scrollbar(hist_frame, orient='vertical', command=self.history_listbox.yview)
        scroll.pack(side='right', fill='y')
        self.history_listbox.configure(yscrollcommand=scroll.set)

    def update_history_display(self):
        self.history_listbox.delete(0, tk.END)
        for entry in reversed(self.roll_history[-50:]):
            display = f"[{entry['timestamp']}] {entry['character']}: "
            display += f"{entry['pool']}d10 → {entry['successes']}S "
            if entry['story_beats'] > 0:
                display += f"{entry['story_beats']}SB "
            display += f"vs DV{entry['dv']} = {entry['outcome']}"
            self.history_listbox.insert(0, display)

    def clear_history(self):
        if messagebox.askyesno("Clear History", "Clear all roll history?"):
            self.roll_history = []
            self.update_history_display()

    def refresh_all_display(self):
        self.refresh_character_display()
        self.refresh_gm_display()
        self.update_dice_total()
        self.update_history_display()

if __name__ == "__main__":
    root = tk.Tk()
    app = FateEdgeApp(root)
    root.mainloop()